const prisma = require("../lib/prisma");
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


function mode(value) {
  if (!VALID_MODES.includes(value)) {
    const error = new Error(
      "Invalid game mode."
    );
    error.code = "INVALID_GAME_MODE";
    throw error;
  }

  return value;
}


function type(value) {
  if (!VALID_TYPES.includes(value)) {
    const error = new Error(
      "Invalid tournament type."
    );
    error.code = "INVALID_TOURNAMENT_TYPE";
    throw error;
  }

  return value;
}


function format(value) {
  if (!VALID_FORMATS.includes(value)) {
    const error = new Error(
      "Invalid tournament format."
    );
    error.code = "INVALID_TOURNAMENT_FORMAT";
    throw error;
  }

  return value;
}


function notFound() {
  const error = new Error(
    "Tournament not found."
  );

  error.code = "TOURNAMENT_NOT_FOUND";

  return error;
}


async function createTournament({
  name,
  category = null,
  mode: gameMode,
  type: tournamentType = "CATEGORY",
  format: tournamentFormat = "SWISS",
}) {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    const error = new Error(
      "Tournament name is required."
    );

    error.code = "INVALID_TOURNAMENT_NAME";
    throw error;
  }

  mode(gameMode);
  type(tournamentType);
  format(tournamentFormat);

  if (
    category !== null &&
    typeof category !== "string"
  ) {
    const error = new Error(
      "Invalid tournament category."
    );

    error.code = "INVALID_CATEGORY";
    throw error;
  }

  const tournament =
    await prisma.tournament.create({
      data: {
        name: name.trim(),
        category: category?.trim() || null,
        mode: gameMode,
        type: tournamentType,
        format: tournamentFormat,
      },

      include: tournamentInclude,
    });

  return tournament;
}


async function getTournamentById(tournamentId) {
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
  mode: gameMode,
  type: tournamentType,
  category,
  page = 1,
  limit = 20,
} = {}) {
  page = Math.max(1, Number(page) || 1);
  limit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  const where = {};

  if (status) {
    where.status = status;
  }

  if (gameMode) {
    mode(gameMode);
    where.mode = gameMode;
  }

  if (tournamentType) {
    type(tournamentType);
    where.type = tournamentType;
  }

  if (category) {
    where.category = category.trim();
  }

  const [tournaments, total] =
    await prisma.$transaction([
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
      totalPages: Math.ceil(total / limit),
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
        const error = new Error(
          "Players can only be registered before the tournament starts."
        );

        error.code =
          "TOURNAMENT_NOT_ACCEPTING_PLAYERS";

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
        tournament.category &&
        tournament.type === "CATEGORY" &&
        player.category !== tournament.category
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
    const error = new Error(
      "Players can only be removed before the tournament starts."
    );

    error.code = "INVALID_TOURNAMENT_STATUS";
    throw error;
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


async function startTournament(tournamentId) {
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
    const error = new Error(
      "Only a DRAFT tournament can be started."
    );

    error.code = "INVALID_TOURNAMENT_STATUS";
    throw error;
  }

  if (tournament._count.players < 2) {
    const error = new Error(
      "A tournament requires at least two players."
    );

    error.code = "INSUFFICIENT_PLAYERS";
    throw error;
  }

  return prisma.tournament.update({
    where: {
      id: tournamentId,
    },

    data: {
      status: "ACTIVE",
      startedAt: new Date(),
    },

    include: tournamentInclude,
  });
}


async function calculateStandings(tournamentId) {
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
        b.totalPoints - a.totalPoints ||
        b.accuracy - a.accuracy ||
        b.ratingAfter - a.ratingAfter ||
        a.playerId - b.playerId
    );

  return sorted.map((result, index) => ({
    ...result,
    rank: index + 1,
  }));
}


async function completeTournament(tournamentId) {
  tournamentId = id(
    tournamentId,
    "tournament ID"
  );

  const standings =
    await calculateStandings(
      tournamentId
    );

  if (!standings.length) {
    const error = new Error(
      "Cannot complete a tournament without results."
    );

    error.code = "NO_TOURNAMENT_RESULTS";
    throw error;
  }

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
    const error = new Error(
      "Only an ACTIVE tournament can be completed."
    );

    error.code = "INVALID_TOURNAMENT_STATUS";
    throw error;
  }

  const champion = standings[0];

  const result =
    await prisma.$transaction(
      async (tx) => {
        for (const standing of standings) {
          await tx.tournamentResult.update({
            where: {
              id: standing.id,
            },

            data: {
              rank: standing.rank,
            },
          });
        }

        const completed =
          await tx.tournament.update({
            where: {
              id: tournamentId,
            },

            data: {
              status: "COMPLETED",
              championPlayerId:
                champion.playerId,
              championUsername:
                champion.player.username,
              championTitle:
                tournament.type === "SPECIAL"
                  ? "Special Champion"
                  : "Category Champion",
              completedAt: new Date(),
            },

            include: tournamentInclude,
          });

        return completed;
      }
    );

  try {
    await notificationService.createNotification({
      playerId: champion.playerId,
      type: "CHAMPIONSHIP",
      title: "Tournament Champion",
      message:
        `Congratulations! You won "${result.name}".`,
    });
  } catch (error) {
    console.error(
      "Tournament notification failed:",
      error
    );
  }

  return {
    tournament: result,
    champion: {
      playerId: champion.playerId,
      username: champion.player.username,
      fullName: champion.player.fullName,
      rank: 1,
      totalPoints: champion.totalPoints,
      accuracy: champion.accuracy,
      ratingBefore: champion.ratingBefore,
      ratingAfter: champion.ratingAfter,
    },
  };
}


async function cancelTournament(tournamentId) {
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
    ["COMPLETED", "CANCELLED"].includes(
      tournament.status
    )
  ) {
    const error = new Error(
      "Tournament cannot be cancelled."
    );

    error.code = "INVALID_TOURNAMENT_STATUS";
    throw error;
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

  page = Math.max(1, Number(page) || 1);
  limit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  const where = {
    players: {
      some: {
        playerId,
      },
    },
  };

  const [tournaments, total] =
    await prisma.$transaction([
      prisma.tournament.findMany({
        where,
        skip: (page - 1) * limit,
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
      totalPages: Math.ceil(
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
  calculateStandings,
  completeTournament,
  cancelTournament,
  getPlayerTournaments,
};
