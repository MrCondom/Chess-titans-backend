const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];
const VALID_TYPES = ["TOURNAMENT", "BULLET"];

const VALID_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

function validateId(value, field = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${field}.`);
  }

  return id;
}

function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }

  return mode;
}

function validateType(type) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(
      "Invalid tournament type."
    );
  }

  return type;
}

function validateCategory(category) {
  if (
    category !== undefined &&
    category !== null &&
    typeof category !== "string"
  ) {
    throw new Error("Invalid category.");
  }

  return typeof category === "string"
    ? category.trim()
    : null;
}

function validateScore(value, field = "score") {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) {
    throw new Error(`Invalid ${field}.`);
  }

  return score;
}

function validateAccuracy(value) {
  const accuracy = Number(value);

  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    throw new Error(
      "Accuracy must be between 0 and 100."
    );
  }

  return accuracy;
}

function validateRating(value, field = "rating") {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 0) {
    throw new Error(`Invalid ${field}.`);
  }

  return rating;
}

function validateTournamentStatus(status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid tournament status.");
  }

  return status;
}


const tournamentInclude = {
  championPlayer: {
    select: {
      id: true,
      fullName: true,
      username: true,
      category: true,
    },
  },

  results: {
    orderBy: [
      {
        rank: "asc",
      },
      {
        totalPoints: "desc",
      },
      {
        totalRounds: "desc",
      },
    ],

    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
          rapidRating: true,
          blitzRating: true,
          bulletRating: true,
        },
      },
    },
  },
};



async function createTournament({
  name,
  category = null,
  mode,
  type = "TOURNAMENT",
}) {
  if (
    typeof name !== "string" ||
    !name.trim()
  ) {
    throw new Error(
      "Tournament name is required."
    );
  }

  validateMode(mode);
  validateType(type);

  category = validateCategory(category);

  const tournament = await prisma.tournament.create({
    data: {
      name: name.trim(),
      category,
      mode,
      type,
      status: "DRAFT",
    },

    include: tournamentInclude,
  });

  return tournament;
}


async function getTournamentById(tournamentId) {
  tournamentId = validateId(
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
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  return tournament;
}


/**
 * Get tournaments.
 */
async function getTournaments({
  status = null,
  mode = null,
  type = null,
  category = null,
  page = 1,
  limit = 20,
} = {}) {
  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  if (limit > 100) {
    limit = 100;
  }

  const where = {};

  if (status) {
    validateTournamentStatus(status);
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

  if (
    category !== undefined &&
    category !== null
  ) {
    category = validateCategory(category);

    where.category = category;
  }

  const skip = (page - 1) * limit;

  const [tournaments, total] =
    await prisma.$transaction([
      prisma.tournament.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            createdAt: "desc",
          },
          {
            id: "desc",
          },
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


async function startTournament(tournamentId) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      include: {
        results: true,
      },
    });

  if (!tournament) {
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  if (tournament.status !== "DRAFT") {
    const error = new Error(
      `Tournament cannot be started because it is ${tournament.status.toLowerCase()}.`
    );

    error.code = "INVALID_TOURNAMENT_STATUS";

    throw error;
  }

  if (tournament.results.length === 0) {
    const error = new Error(
      "Tournament must have at least one registered player before it can start."
    );

    error.code = "NO_TOURNAMENT_PLAYERS";

    throw error;
  }

  const updated =
    await prisma.tournament.update({
      where: {
        id: tournamentId,
      },

      data: {
        status: "ACTIVE",
        startedAt: new Date(),
      },

      include: tournamentInclude,
    });

  return updated;
}


async function registerPlayer(
  tournamentId,
  playerId
) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  playerId = validateId(
    playerId,
    "player ID"
  );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const tournament =
          await tx.tournament.findUnique({
            where: {
              id: tournamentId,
            },
          });

        if (!tournament) {
          const error = new Error(
            "Tournament not found."
          );

          error.code = "TOURNAMENT_NOT_FOUND";

          throw error;
        }

        if (tournament.status !== "DRAFT") {
          const error = new Error(
            "Players can only be registered while the tournament is in DRAFT status."
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
              status: true,
              category: true,
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
            "Inactive players cannot be registered for a tournament."
          );

          error.code = "PLAYER_INACTIVE";

          throw error;
        }

       
        if (
          tournament.category &&
          player.category !== tournament.category
        ) {
          const error = new Error(
            "Player does not belong to the tournament category."
          );

          error.code =
            "PLAYER_CATEGORY_MISMATCH";

          throw error;
        }

        const existing =
          await tx.tournamentResult.findUnique({
            where: {
              tournamentId_playerId: {
                tournamentId,
                playerId,
              },
            },
          });

        if (existing) {
          const error = new Error(
            "Player is already registered for this tournament."
          );

          error.code =
            "PLAYER_ALREADY_REGISTERED";

          throw error;
        }

        return tx.tournamentResult.create({
          data: {
            tournamentId,
            playerId,

            rank: 0,

            totalPoints: 0,
            totalRounds: 0,
            accuracy: 0,

            ratingBefore: 0,
            ratingAfter: 0,
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

  return result;
}


async function removePlayer(
  tournamentId,
  playerId
) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  playerId = validateId(
    playerId,
    "player ID"
  );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const tournament =
          await tx.tournament.findUnique({
            where: {
              id: tournamentId,
            },
          });

        if (!tournament) {
          const error = new Error(
            "Tournament not found."
          );

          error.code = "TOURNAMENT_NOT_FOUND";

          throw error;
        }

        if (tournament.status !== "DRAFT") {
          const error = new Error(
            "Players can only be removed while the tournament is in DRAFT status."
          );

          error.code =
            "INVALID_TOURNAMENT_STATUS";

          throw error;
        }

        const participant =
          await tx.tournamentResult.findUnique({
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

          error.code =
            "PLAYER_NOT_REGISTERED";

          throw error;
        }

        await tx.tournamentResult.delete({
          where: {
            id: participant.id,
          },
        });

        return {
          success: true,
          tournamentId,
          playerId,
        };
      }
    );

  return result;
}


async function updateTournamentResult({
  tournamentId,
  playerId,
  totalPoints,
  totalRounds,
  accuracy,
  ratingBefore,
  ratingAfter,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  playerId = validateId(
    playerId,
    "player ID"
  );

  const points = validateScore(
    totalPoints,
    "total points"
  );

  const rounds = Number(totalRounds);

  if (
    !Number.isInteger(rounds) ||
    rounds < 0
  ) {
    throw new Error(
      "Invalid total rounds."
    );
  }

  const accuracyValue =
    validateAccuracy(accuracy);

  const before = validateRating(
    ratingBefore,
    "rating before"
  );

  const after = validateRating(
    ratingAfter,
    "rating after"
  );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const tournament =
          await tx.tournament.findUnique({
            where: {
              id: tournamentId,
            },
          });

        if (!tournament) {
          const error = new Error(
            "Tournament not found."
          );

          error.code = "TOURNAMENT_NOT_FOUND";

          throw error;
        }

        if (
          tournament.status !== "ACTIVE" &&
          tournament.status !== "DRAFT"
        ) {
          const error = new Error(
            "Tournament results cannot be modified after completion or cancellation."
          );

          error.code =
            "INVALID_TOURNAMENT_STATUS";

          throw error;
        }

        const participant =
          await tx.tournamentResult.findUnique({
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

          error.code =
            "PLAYER_NOT_REGISTERED";

          throw error;
        }

        return tx.tournamentResult.update({
          where: {
            id: participant.id,
          },

          data: {
            totalPoints: points,
            totalRounds: rounds,
            accuracy: accuracyValue,
            ratingBefore: before,
            ratingAfter: after,
          },

          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                username: true,
              },
            },
          },
        });
      }
    );

  return result;
}


async function calculateStandings(tournamentId) {
  tournamentId = validateId(
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
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  const sorted =
    [...tournament.results].sort(
      (a, b) => {
        if (
          b.totalPoints !==
          a.totalPoints
        ) {
          return (
            b.totalPoints -
            a.totalPoints
          );
        }

        if (
          b.totalRounds !==
          a.totalRounds
        ) {
          return (
            b.totalRounds -
            a.totalRounds
          );
        }

        if (
          b.accuracy !==
          a.accuracy
        ) {
          return (
            b.accuracy -
            a.accuracy
          );
        }

        if (
          b.ratingAfter !==
          a.ratingAfter
        ) {
          return (
            b.ratingAfter -
            a.ratingAfter
          );
        }

        return a.playerId - b.playerId;
      }
    );

  
  let previous = null;
  let currentRank = 0;

  const standings = sorted.map(
    (entry, index) => {
      const sameAsPrevious =
        previous &&
        entry.totalPoints ===
          previous.totalPoints &&
        entry.totalRounds ===
          previous.totalRounds &&
        entry.accuracy ===
          previous.accuracy &&
        entry.ratingAfter ===
          previous.ratingAfter;

      if (!sameAsPrevious) {
        currentRank = index + 1;
      }

      previous = entry;

      return {
        ...entry,
        rank: currentRank,
      };
    }
  );

  return standings;
}


async function saveStandings(tournamentId) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const standings =
    await calculateStandings(
      tournamentId
    );

  if (standings.length === 0) {
    return [];
  }

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

        return tx.tournamentResult.findMany({
          where: {
            tournamentId,
          },

          orderBy: [
            {
              rank: "asc",
            },
            {
              totalPoints: "desc",
            },
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
        });
      }
    );

  return result;
}


async function getStandings(tournamentId) {
  return calculateStandings(tournamentId);
}


async function completeTournament(
  tournamentId
) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const result =
    await prisma.$transaction(
      async (tx) => {
        const tournament =
          await tx.tournament.findUnique({
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
                    },
                  },
                },
              },
            },
          });

        if (!tournament) {
          const error = new Error(
            "Tournament not found."
          );

          error.code =
            "TOURNAMENT_NOT_FOUND";

          throw error;
        }

        if (
          tournament.status !==
          "ACTIVE"
        ) {
          const error = new Error(
            "Only an ACTIVE tournament can be completed."
          );

          error.code =
            "INVALID_TOURNAMENT_STATUS";

          throw error;
        }

        if (
          tournament.results.length ===
          0
        ) {
          const error = new Error(
            "Cannot complete a tournament without players."
          );

          error.code =
            "NO_TOURNAMENT_PLAYERS";

          throw error;
        }

        /*
         * Sort standings.
         */
        const sorted =
          [...tournament.results].sort(
            (a, b) => {
              if (
                b.totalPoints !==
                a.totalPoints
              ) {
                return (
                  b.totalPoints -
                  a.totalPoints
                );
              }

              if (
                b.totalRounds !==
                a.totalRounds
              ) {
                return (
                  b.totalRounds -
                  a.totalRounds
                );
              }

              if (
                b.accuracy !==
                a.accuracy
              ) {
                return (
                  b.accuracy -
                  a.accuracy
                );
              }

              if (
                b.ratingAfter !==
                a.ratingAfter
              ) {
                return (
                  b.ratingAfter -
                  a.ratingAfter
                );
              }

              return (
                a.playerId -
                b.playerId
              );
            }
          );

        let previous = null;
        let currentRank = 0;

        for (
          let i = 0;
          i < sorted.length;
          i++
        ) {
          const entry = sorted[i];

          const sameAsPrevious =
            previous &&
            entry.totalPoints ===
              previous.totalPoints &&
            entry.totalRounds ===
              previous.totalRounds &&
            entry.accuracy ===
              previous.accuracy &&
            entry.ratingAfter ===
              previous.ratingAfter;

          if (!sameAsPrevious) {
            currentRank = i + 1;
          }

          await tx.tournamentResult.update({
            where: {
              id: entry.id,
            },

            data: {
              rank: currentRank,
            },
          });

          previous = entry;
        }

        const champion =
          sorted[0];

        const championTitle =
          tournament.type ===
          "BULLET"
            ? "Bullet Champion"
            : "Tournament Champion";

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

              championTitle,

              completedAt:
                new Date(),
            },

            include: tournamentInclude,
          });

        return {
          tournament: completed,

          champion: {
            playerId:
              champion.playerId,

            username:
              champion.player.username,

            fullName:
              champion.player.fullName,

            rank: 1,

            totalPoints:
              champion.totalPoints,

            totalRounds:
              champion.totalRounds,

            accuracy:
              champion.accuracy,

            ratingBefore:
              champion.ratingBefore,

            ratingAfter:
              champion.ratingAfter,
          },
        };
      }
    );

 
  try {
    await notificationService.createNotification({
      playerId:
        result.champion.playerId,

      type: "CHAMPIONSHIP",

      title:
        "Tournament Champion",

      message:
        `Congratulations! You won "${result.tournament.name}" and are now the ${result.tournament.championTitle}.`,
    });
  } catch (error) {
    console.error(
      "TOURNAMENT CHAMPION NOTIFICATION ERROR:",
      error
    );
  }

  return result;
}


/**
 * Cancel a tournament.
 */
async function cancelTournament(
  tournamentId
) {
  tournamentId = validateId(
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
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  if (
    tournament.status ===
    "COMPLETED"
  ) {
    const error = new Error(
      "A completed tournament cannot be cancelled."
    );

    error.code =
      "INVALID_TOURNAMENT_STATUS";

    throw error;
  }

  if (
    tournament.status ===
    "CANCELLED"
  ) {
    const error = new Error(
      "Tournament is already cancelled."
    );

    error.code =
      "INVALID_TOURNAMENT_STATUS";

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


/**
 * Get tournaments involving a particular player.
 */
async function getPlayerTournaments(
  playerId,
  {
    page = 1,
    limit = 20,
  } = {}
) {
  playerId = validateId(
    playerId,
    "player ID"
  );

  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  if (limit > 100) {
    limit = 100;
  }

  const skip = (page - 1) * limit;

  const where = {
    results: {
      some: {
        playerId,
      },
    },
  };

  const [tournaments, total] =
    await prisma.$transaction([
      prisma.tournament.findMany({
        where,
        skip,
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
  startTournament,
  registerPlayer,
  removePlayer,
  updateTournamentResult,
  calculateStandings,
  saveStandings,
  getStandings,
  completeTournament,
  cancelTournament,
  getPlayerTournaments,
};
