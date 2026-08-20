const prisma = require("../lib/prisma");

const pairingService = require("./pairingService");
const resultService = require("./resultService");
const ratingService = require("./ratingService");
const playerService = require("./playerService");
const rankingService = require("./rankingService");
const notificationService = require("./notificationService");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];
const VALID_TYPES = ["CATEGORY", "SPECIAL", "TEAM"];
const VALID_FORMATS = ["SWISS", "ROUND_ROBIN", "TEAM_BOARD"];

const tournamentInclude = {
  championPlayer: {
    select: {
      id: true,
      fullName: true,
      username: true,
      category: true,
    },
  },

  players: {
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },
    },
  },

  pairings: {
    orderBy: [
      { round: "asc" },
      { id: "asc" },
    ],
    include: {
      whitePlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
      blackPlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
        },
      },
      result: true,
    },
  },

  teamPairings: {
    orderBy: [
      { round: "asc" },
      { id: "asc" },
    ],
    include: {
      teamA: true,
      teamB: true,
      games: true,
    },
  },

  results: {
    orderBy: [
      { rank: "asc" },
      { totalPoints: "desc" },
    ],
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },
    },
  },
};


function id(value, field = "ID") {
  const result = Number(value);

  if (!Number.isInteger(result) || result <= 0) {
    const error = new Error(`Invalid ${field}.`);
    error.code = "INVALID_ID";
    throw error;
  }

  return result;
}


function validateMode(value) {
  if (!VALID_MODES.includes(value)) {
    const error = new Error("Invalid game mode.");
    error.code = "INVALID_GAME_MODE";
    throw error;
  }

  return value;
}


function validateType(value) {
  if (!VALID_TYPES.includes(value)) {
    const error = new Error("Invalid tournament type.");
    error.code = "INVALID_TOURNAMENT_TYPE";
    throw error;
  }

  return value;
}


function validateFormat(value) {
  if (!VALID_FORMATS.includes(value)) {
    const error = new Error("Invalid tournament format.");
    error.code = "INVALID_TOURNAMENT_FORMAT";
    throw error;
  }

  return value;
}


function notFound() {
  const error = new Error("Tournament not found.");
  error.code = "TOURNAMENT_NOT_FOUND";
  return error;
}


function statusError(message) {
  const error = new Error(message);
  error.code = "INVALID_TOURNAMENT_STATUS";
  return error;
}


async function createTournament({
  name,
  category = null,
  mode,
  type = "CATEGORY",
  format = "SWISS",
  totalRounds = 1,
  roundDurationMinutes = 0,
  playerIds = [],
}) {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    const error = new Error("Tournament name is required.");
    error.code = "INVALID_TOURNAMENT_NAME";
    throw error;
  }

  validateMode(mode);
  validateType(type);
  validateFormat(format);

  totalRounds = Number(totalRounds);
  roundDurationMinutes = Number(roundDurationMinutes);

  if (
    !Number.isInteger(totalRounds) ||
    totalRounds < 1
  ) {
    const error = new Error(
      "Total rounds must be at least 1."
    );
    error.code = "INVALID_TOTAL_ROUNDS";
    throw error;
  }

  if (
    !Number.isInteger(roundDurationMinutes) ||
    roundDurationMinutes < 0
  ) {
    const error = new Error(
      "Invalid round duration."
    );
    error.code = "INVALID_ROUND_DURATION";
    throw error;
  }

  if (
    category !== null &&
    typeof category !== "string"
  ) {
    const error = new Error("Invalid tournament category.");
    error.code = "INVALID_CATEGORY";
    throw error;
  }

  const uniquePlayerIds = [
    ...new Set(
      playerIds.map((playerId) =>
        id(playerId, "player ID")
      )
    ),
  ];

  
  if (
    type !== "TEAM" &&
    uniquePlayerIds.length === 0
  ) {
    const error = new Error(
      "At least one player must be selected."
    );

    error.code = "NO_PLAYERS_SELECTED";
    throw error;
  }

  return prisma.$transaction(
    async (tx) => {
      const tournament =
        await tx.tournament.create({
          data: {
            name: name.trim(),
            category:
              category?.trim() || null,
            mode,
            type,
            format,
            totalRounds,
            currentRound: 0,
            roundDurationMinutes,
            status: "DRAFT",
          },
        });

      if (uniquePlayerIds.length) {
        const players =
          await tx.player.findMany({
            where: {
              id: {
                in: uniquePlayerIds,
              },
              status: "ACTIVE",
            },
            select: {
              id: true,
              category: true,
            },
          });

        if (
          players.length !==
          uniquePlayerIds.length
        ) {
          const error = new Error(
            "One or more selected players are invalid or inactive."
          );

          error.code =
            "INVALID_TOURNAMENT_PLAYERS";

          throw error;
        }

        if (
          type === "CATEGORY" &&
          category
        ) {
          const invalidPlayer =
            players.find(
              (player) =>
                player.category !== category
            );

          if (invalidPlayer) {
            const error = new Error(
              "All players must belong to the tournament category."
            );

            error.code =
              "PLAYER_CATEGORY_MISMATCH";

            throw error;
          }
        }

        await tx.tournamentPlayer.createMany({
          data: uniquePlayerIds.map(
            (playerId) => ({
              tournamentId: tournament.id,
              playerId,
            })
          ),
        });
      }

      return tx.tournament.findUnique({
        where: {
          id: tournament.id,
        },
        include: tournamentInclude,
      });
    }
  );
}


async function getTournamentById(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
      include: tournamentInclude,
    });

  if (!tournament) {
    throw notFound();
  }

  return tournament;
}


async function getTournaments({
  status,
  mode,
  type,
  category,
  page = 1,
  limit = 20,
} = {}) {
  page = Math.max(
    1,
    Number(page) || 1
  );

  limit = Math.min(
    100,
    Math.max(
      1,
      Number(limit) || 20
    )
  );

  const where = {};

  if (status) {
    where.status = status;
  }

  if (mode) {
    validateMode(mode);
    where.mode = mode;
  }

  if (type) {
    validateType(type);
    where.type = type;
  }

  if (category) {
    where.category = category.trim();
  }

  const [
    tournaments,
    total,
  ] = await prisma.$transaction([
    prisma.tournament.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,

      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],

      include: {
        championPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },

        _count: {
          select: {
            players: true,
            pairings: true,
            teamPairings: true,
            results: true,
          },
        },
      },
    }),

    prisma.tournament.count({
      where,
    }),
  ]);

  return {
    tournaments,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(
        total / limit
      ),
    },
  };
}


async function registerPlayer(
  tournamentId,
  playerId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  playerId = id(
    playerId,
    "player ID"
  );

  return prisma.$transaction(
    async (tx) => {
      const tournament =
        await tx.tournament.findUnique({
          where: {
            id: tournamentId,
          },
        });

      if (!tournament) {
        throw notFound();
      }

      if (tournament.status !== "DRAFT") {
        throw statusError(
          "Players can only be added before the tournament starts."
        );
      }

      if (tournament.type === "TEAM") {
        const error = new Error(
          "Team tournaments use teams, not direct player registration."
        );

        error.code =
          "TEAM_TOURNAMENT_PLAYER_REGISTRATION";

        throw error;
      }

      const player =
        await tx.player.findUnique({
          where: {
            id: playerId,
          },
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
            status: true,
          },
        });

      if (!player) {
        const error = new Error(
          "Player not found."
        );
        error.code = "PLAYER_NOT_FOUND";
        throw error;
      }

      if (player.status !== "ACTIVE") {
        const error = new Error(
          "Player is not active."
        );
        error.code = "PLAYER_INACTIVE";
        throw error;
      }

      if (
        tournament.type === "CATEGORY" &&
        tournament.category &&
        player.category !==
          tournament.category
      ) {
        const error = new Error(
          "Player does not belong to this tournament category."
        );

        error.code =
          "PLAYER_CATEGORY_MISMATCH";

        throw error;
      }

      return tx.tournamentPlayer.create({
        data: {
          tournamentId,
          playerId,
        },

        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              category: true,
            },
          },
        },
      });
    }
  );
}


async function removePlayer(
  tournamentId,
  playerId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  playerId = id(
    playerId,
    "player ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
    });

  if (!tournament) {
    throw notFound();
  }

  if (tournament.status !== "DRAFT") {
    throw statusError(
      "Players can only be removed before the tournament starts."
    );
  }

  const participant =
    await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId,
          playerId,
        },
      },
    });

  if (!participant) {
    const error = new Error(
      "Player is not registered for this tournament."
    );

    error.code = "PLAYER_NOT_REGISTERED";
    throw error;
  }

  await prisma.tournamentPlayer.delete({
    where: {
      id: participant.id,
    },
  });

  return {
    tournamentId,
    playerId,
  };
}


async function startTournament(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                username: true,
                category: true,
                status: true,
              },
            },
          },
        },

        _count: {
          select: {
            players: true,
          },
        },
      },
    });

  if (!tournament) {
    throw notFound();
  }

  if (tournament.status !== "DRAFT") {
    throw statusError(
      "Only a DRAFT tournament can be started."
    );
  }

  if (
    tournament.type !== "TEAM" &&
    tournament._count.players < 2
  ) {
    const error = new Error(
      "A tournament requires at least two players."
    );

    error.code = "INSUFFICIENT_PLAYERS";
    throw error;
  }

  
  await prisma.tournament.update({
    where: {
      id: tournamentId,
    },

    data: {
      status: "ACTIVE",
      currentRound: 1,
      startedAt: new Date(),
    },
  });

  try {
    
    if (tournament.type !== "TEAM") {
      await pairingService.createTournamentRound({
        tournamentId,
        round: 1,
        mode: tournament.mode,
        format: tournament.format,
        category: tournament.category,
        totalRounds: tournament.totalRounds,
      });
    }

    /*
     * TEAM TOURNAMENT
     */
    else {
      await pairingService.createTeamTournamentRound({
        tournamentId,
        round: 1,
        mode: tournament.mode,
        format: tournament.format,
      });
    }

    
    await notificationService.notifyTournamentRound(
      tournamentId,
      1
    );

    return getTournamentById(
      tournamentId
    );
  } catch (error) {
    /*
     * Do not leave a broken ACTIVE tournament.
     */
    await prisma.tournament.update({
      where: {
        id: tournamentId,
      },

      data: {
        status: "DRAFT",
        currentRound: 0,
        startedAt: null,
      },
    });

    throw error;
  }
}


async function advanceRound(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
    });

  if (!tournament) {
    throw notFound();
  }

  if (tournament.status !== "ACTIVE") {
    throw statusError(
      "Only an ACTIVE tournament can advance rounds."
    );
  }

  if (
    tournament.currentRound >=
    tournament.totalRounds
  ) {
    const error = new Error(
      "All tournament rounds have been completed."
    );

    error.code = "ALL_ROUNDS_COMPLETED";
    throw error;
  }

  
  const pending =
    await resultService.getPendingTournamentResults(
      tournamentId,
      tournament.currentRound
    );

  if (pending > 0) {
    const error = new Error(
      "The current round still has pending results."
    );

    error.code =
      "ROUND_RESULTS_PENDING";

    throw error;
  }

  const nextRound =
    tournament.currentRound + 1;

  if (tournament.type === "TEAM") {
    await pairingService.createTeamTournamentRound({
      tournamentId,
      round: nextRound,
      mode: tournament.mode,
      format: tournament.format,
    });
  } else {
    await pairingService.createTournamentRound({
      tournamentId,
      round: nextRound,
      mode: tournament.mode,
      format: tournament.format,
      category: tournament.category,
      totalRounds: tournament.totalRounds,
    });
  }

  await prisma.tournament.update({
    where: {
      id: tournamentId,
    },

    data: {
      currentRound: nextRound,
    },
  });

  await notificationService.notifyTournamentRound(
    tournamentId,
    nextRound
  );

  return getTournamentById(
    tournamentId
  );
}



async function calculateStandings(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      include: {
        results: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                username: true,
                category: true,
              },
            },
          },
        },
      },
    });

  if (!tournament) {
    throw notFound();
  }

  const sorted =
    [...tournament.results].sort(
      (a, b) =>
        b.totalPoints -
          a.totalPoints ||
        b.accuracy -
          a.accuracy ||
        b.ratingAfter -
          a.ratingAfter ||
        a.playerId -
          b.playerId
    );

  return sorted.map(
    (result, index) => ({
      ...result,
      rank: index + 1,
    })
  );
}


async function completeTournament(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
    });

  if (!tournament) {
    throw notFound();
  }

  if (tournament.status !== "ACTIVE") {
    throw statusError(
      "Only an ACTIVE tournament can be completed."
    );
  }

  if (
    tournament.currentRound <
    tournament.totalRounds
  ) {
    const error = new Error(
      "All tournament rounds must be completed first."
    );

    error.code =
      "TOURNAMENT_ROUNDS_INCOMPLETE";

    throw error;
  }

  
  const pending =
    await resultService.getPendingTournamentResults(
      tournamentId
    );

  if (pending > 0) {
    const error = new Error(
      "Tournament still has pending results."
    );

    error.code =
      "TOURNAMENT_RESULTS_PENDING";

    throw error;
  }

  
  const finalResults =
    await resultService.buildTournamentResults(
      tournamentId
    );

  if (!finalResults.length) {
    const error = new Error(
      "Cannot complete tournament without results."
    );

    error.code =
      "NO_TOURNAMENT_RESULTS";

    throw error;
  }

  
  const standings =
    await rankingService.calculateTournamentRanking(
      tournamentId,
      finalResults
    );

  const champion =
    standings[0];

  
  await prisma.$transaction(
    async (tx) => {
      for (
        const standing of standings
      ) {
        await tx.tournamentResult.upsert({
          where: {
            tournamentId_playerId: {
              tournamentId,
              playerId:
                standing.playerId,
            },
          },

          create: {
            tournamentId,
            playerId:
              standing.playerId,
            rank: standing.rank,
            totalPoints:
              standing.totalPoints,
            totalRounds:
              standing.totalRounds,
            accuracy:
              standing.accuracy,
            ratingBefore:
              standing.ratingBefore,
            ratingAfter:
              standing.ratingAfter,
          },

          update: {
            rank: standing.rank,
            totalPoints:
              standing.totalPoints,
            totalRounds:
              standing.totalRounds,
            accuracy:
              standing.accuracy,
            ratingBefore:
              standing.ratingBefore,
            ratingAfter:
              standing.ratingAfter,
          },
        });
      }
    }
  );

  
  await playerService.applyTournamentCompletion({
    tournamentId,
    standings,
    mode: tournament.mode,
  });

 
  await rankingService.saveTournamentRankings({
    tournamentId,
    standings,
    mode: tournament.mode,
    category: tournament.category,
    type: tournament.type,
  });

  
  const completed =
    await prisma.tournament.update({
      where: {
        id: tournamentId,
      },

      data: {
        status: "COMPLETED",

        championPlayerId:
          champion.playerId,

        championUsername:
          champion.username,

        championTitle:
          tournament.type === "SPECIAL"
            ? "Special Champion"
            : tournament.type === "CATEGORY"
              ? "Category Champion"
              : "Team Champion",

        completedAt: new Date(),
      },

      include: tournamentInclude,
    });

  await notificationService.createNotification({
    playerId:
      champion.playerId,

    type: "CHAMPIONSHIP",

    title:
      "Tournament Champion",

    message:
      `Congratulations! You won "${completed.name}".`,
  });

  
  await notificationService.notifyTournamentCompleted(
    tournamentId
  );

  return {
    tournament: completed,

    champion: {
      playerId:
        champion.playerId,

      username:
        champion.username,

      fullName:
        champion.fullName,

      rank: 1,

      totalPoints:
        champion.totalPoints,

      accuracy:
        champion.accuracy,

      ratingBefore:
        champion.ratingBefore,

      ratingAfter:
        champion.ratingAfter,
    },

    standings,
  };
}


async function cancelTournament(
  tournamentId
) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
    });

  if (!tournament) {
    throw notFound();
  }

  if (
    ["COMPLETED", "CANCELLED"]
      .includes(tournament.status)
  ) {
    throw statusError(
      "Tournament cannot be cancelled."
    );
  }

  return prisma.tournament.update({
    where: {
      id: tournamentId,
    },

    data: {
      status: "CANCELLED",
    },

    include: tournamentInclude,
  });
}


async function getPlayerTournaments(
  playerId,
  {
    page = 1,
    limit = 20,
  } = {}
) {
  playerId = id(
    playerId,
    "player ID"
  );

  page = Math.max(
    1,
    Number(page) || 1
  );

  limit = Math.min(
    100,
    Math.max(
      1,
      Number(limit) || 20
    )
  );

  const where = {
    players: {
      some: {
        playerId,
      },
    },
  };

  const [
    tournaments,
    total,
  ] = await prisma.$transaction([
    prisma.tournament.findMany({
      where,

      skip:
        (page - 1) * limit,

      take: limit,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        championPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },

        results: {
          where: {
            playerId,
          },

          select: {
            rank: true,
            totalPoints: true,
            totalRounds: true,
            accuracy: true,
            ratingBefore: true,
            ratingAfter: true,
          },
        },
      },
    }),

    prisma.tournament.count({
      where,
    }),
  ]);

  return {
    tournaments,

    pagination: {
      page,
      limit,
      total,
      totalPages:
        Math.ceil(
          total / limit
        ),
    },
  };
}


module.exports = {
  createTournament,
  getTournamentById,
  getTournaments,

  registerPlayer,
  removePlayer,

  startTournament,
  advanceRound,

  calculateStandings,
  completeTournament,

  cancelTournament,

  getPlayerTournaments,
};
