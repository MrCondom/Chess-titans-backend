const prisma = require("../lib/prisma");

const {
  calculateRatingChange,
} = require("../utils/ratingCalculator");

const {
  getWinStreak,
  getLossStreak,
  getWinMultiplier,
  getLossMultiplier,
} = require("../utils/streak");


// =====================================================
// VALIDATION
// =====================================================

function validateId(value, name = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${name}.`);
    error.code = "INVALID_ID";
    throw error;
  }

  return id;
}


function validateMode(mode) {
  if (
    mode !== undefined &&
    mode !== null &&
    mode !== "RAPID" &&
    mode !== "BLITZ" &&
    mode !== "BULLET"
  ) {
    const error = new Error(
      "Invalid game mode. Use RAPID, BLITZ or BULLET."
    );

    error.code = "INVALID_GAME_MODE";

    throw error;
  }

  return mode;
}


// =====================================================
// PLAYER RATING
// =====================================================

function getPlayerRating(player, mode) {
  switch (mode) {
    case "RAPID":
      return player.rapidRating;

    case "BLITZ":
      return player.blitzRating;

    case "BULLET":
      return player.bulletRating;

    default: {
      const error = new Error("Invalid game mode.");
      error.code = "INVALID_GAME_MODE";
      throw error;
    }
  }
}

// =====================================================
// RATING UPDATE
// =====================================================

function getRatingUpdate(mode, amount) {
  switch (mode) {
    case "RAPID":
      return {
        rapidRating: {
          increment: amount,
        },

        rapidGain: {
          increment: amount,
        },
      };

    case "BLITZ":
      return {
        blitzRating: {
          increment: amount,
        },

        blitzGain: {
          increment: amount,
        },
      };

    case "BULLET":
      return {
        bulletRating: {
          increment: amount,
        },

        bulletGain: {
          increment: amount,
        },
      };

    default: {
      const error = new Error(
        "Invalid game mode."
      );

      error.code =
        "INVALID_GAME_MODE";

      throw error;
    }
  }
}


// =====================================================
// STREAK MULTIPLIER
// =====================================================

function calculateStreakMultiplier(
  results,
  playerId,
  mode,
  category,
  baseChange
) {
  if (baseChange > 0) {
    return getWinMultiplier(
      getWinStreak(
        results,
        playerId,
        mode,
        category
      )
    );
  }

  if (baseChange < 0) {
    return getLossMultiplier(
      getLossStreak(
        results,
        playerId,
        mode,
        category
      )
    );
  }

  return 1;
}


// =====================================================
// CALCULATE GAINS
// =====================================================
async function calculateGains(tx, gameResult) {
  const whiteRating =
    getPlayerRating(
      gameResult.whitePlayer,
      gameResult.mode
    );

  const blackRating =
    getPlayerRating(
      gameResult.blackPlayer,
      gameResult.mode
    );

  // ---------------------------------------------
  // Calculate the base rating changes
  // ---------------------------------------------

  const {
    changeA,
    changeB,
  } = calculateRatingChange(
    whiteRating,
    blackRating,
    gameResult.whiteScore,
    gameResult.blackScore
  );

  // ---------------------------------------------
  // Get only results BEFORE this result
  // ---------------------------------------------

  const previousWhiteResults =
    await getPlayerStreakResults(
      tx,
      gameResult.whitePlayerId,
      gameResult.date
    );

  const previousBlackResults =
    await getPlayerStreakResults(
      tx,
      gameResult.blackPlayerId,
      gameResult.date
    );

  // ---------------------------------------------
  // Calculate white streak multiplier
  // ---------------------------------------------

  const whiteMultiplier =
    calculateStreakMultiplier(
      previousWhiteResults,
      gameResult.whitePlayerId,
      gameResult.mode,
      gameResult.category,
      changeA
    );

  // ---------------------------------------------
  // Calculate black streak multiplier
  // ---------------------------------------------

  const blackMultiplier =
    calculateStreakMultiplier(
      previousBlackResults,
      gameResult.blackPlayerId,
      gameResult.mode,
      gameResult.category,
      changeB
    );

  // ---------------------------------------------
  // Final gains
  // ---------------------------------------------

  return {
    whiteGain:
      changeA * whiteMultiplier,

    blackGain:
      changeB * blackMultiplier,
  };
}


async function getPlayerStreakResults(
  tx,
  playerId,
  beforeDate = null
) {
  const player = await tx.player.findUnique({
    where: {
      id: playerId,
    },

    select: {
      id: true,
      category: true,
    },
  });

  if (!player) {
    const error = new Error(
      "Player not found."
    );

    error.code =
      "PLAYER_NOT_FOUND";

    throw error;
  }

  // ---------------------------------------------
  // Normal / special games
  // ---------------------------------------------

  const gameWhere = {
    approvalStatus: "APPROVED",

    OR: [
      {
        whitePlayerId: playerId,
      },
      {
        blackPlayerId: playerId,
      },
    ],
  };

  // Only include games that happened before
  // the result currently being calculated.
  if (beforeDate) {
    gameWhere.date = {
      lt: beforeDate,
    };
  }

  const gameResults =
    await tx.gameResult.findMany({
      where: gameWhere,

      select: {
        id: true,
        date: true,
        whitePlayerId: true,
        blackPlayerId: true,
        whiteScore: true,
        blackScore: true,
        mode: true,
        category: true,
        approvalStatus: true,
      },

      orderBy: {
        date: "asc",
      },
    });

  // ---------------------------------------------
  // Team games
  // ---------------------------------------------

  const teamWhere = {
    approvalStatus: "APPROVED",

    OR: [
      {
        whitePlayerId: playerId,
      },
      {
        blackPlayerId: playerId,
      },
    ],
  };

  // Team games use TeamPairing.createdAt
  // as their chronological timestamp.
  if (beforeDate) {
    teamWhere.teamPairing = {
      createdAt: {
        lt: beforeDate,
      },
    };
  }

  const teamGames =
    await tx.teamGame.findMany({
      where: teamWhere,

      include: {
        teamPairing: {
          select: {
            mode: true,
            createdAt: true,
          },
        },
      },

      orderBy: {
        teamPairing: {
          createdAt: "asc",
        },
      },
    });

  // ---------------------------------------------
  // Normalize normal games
  // ---------------------------------------------

  const normalizedGames =
    gameResults.map((game) => ({
      id: `GAME-${game.id}`,

      whitePlayerId:
        game.whitePlayerId,

      blackPlayerId:
        game.blackPlayerId,

      whiteScore:
        game.whiteScore,

      blackScore:
        game.blackScore,

      mode:
        game.mode,

      category:
        game.category,

      approvalStatus:
        game.approvalStatus,

      date:
        game.date,
    }));

  // ---------------------------------------------
  // Normalize team games
  // ---------------------------------------------

  const normalizedTeamGames =
    teamGames.map((game) => {
      const whiteScore =
        Number(game.result);

      const blackScore =
        2 - whiteScore;

      return {
        id: `TEAM-${game.id}`,

        whitePlayerId:
          game.whitePlayerId,

        blackPlayerId:
          game.blackPlayerId,

        whiteScore,

        blackScore,

        mode:
          game.teamPairing.mode,

        // For team games, category is based
        // on the individual player's category.
        category:
          player.category,

        approvalStatus:
          game.approvalStatus,

        date:
          game.teamPairing.createdAt,
      };
    });

  // ---------------------------------------------
  // Combine and sort chronologically
  // ---------------------------------------------

  return [
    ...normalizedGames,
    ...normalizedTeamGames,
  ].sort(
    (a, b) =>
      new Date(a.date).getTime() -
      new Date(b.date).getTime()
  );
}

// =====================================================
// CALCULATE TEAM GAME GAINS
// =====================================================

async function calculateTeamGameGains(
  tx,
  teamGame
) {
  const whitePlayer =
    teamGame.whitePlayer;

  const blackPlayer =
    teamGame.blackPlayer;

  if (
    !whitePlayer ||
    !blackPlayer
  ) {
    const error = new Error(
      "Team game players not found."
    );

    error.code =
      "PLAYER_NOT_FOUND";

    throw error;
  }

  const mode =
    teamGame.teamPairing.mode;

  // =================================================
  // CURRENT RATINGS
  // =================================================

  const whiteRating =
    getPlayerRating(
      whitePlayer,
      mode
    );

  const blackRating =
    getPlayerRating(
      blackPlayer,
      mode
    );

  // =================================================
  // TEAM GAME SCORE
  // =================================================

  const whiteScore =
    Number(teamGame.result);

  const blackScore =
    2 - whiteScore;

  // =================================================
  // BASE RATING CHANGE
  // =================================================

  const {
    changeA,
    changeB,
  } = calculateRatingChange(
    whiteRating,
    blackRating,
    whiteScore,
    blackScore
  );

  // =================================================
  // WHITE PLAYER STREAK
  // =================================================

  const whiteResults =
    await getPlayerStreakResults(
      tx,
      teamGame.whitePlayerId,
      teamGame.teamPairing.createdAt
    );

  const whiteMultiplier =
    calculateStreakMultiplier(
      whiteResults,
      teamGame.whitePlayerId,
      mode,
      whitePlayer.category,
      changeA
    );

  // =================================================
  // BLACK PLAYER STREAK
  // =================================================

  const blackResults =
    await getPlayerStreakResults(
      tx,
      teamGame.blackPlayerId,
      teamGame.teamPairing.createdAt
    );

  const blackMultiplier =
    calculateStreakMultiplier(
      blackResults,
      teamGame.blackPlayerId,
      mode,
      blackPlayer.category,
      changeB
    );

  // =================================================
  // FINAL GAINS
  // =================================================

  return {
    whiteGain:
      changeA * whiteMultiplier,

    blackGain:
      changeB * blackMultiplier,
  };
}

// =====================================================
// GET RESULTS
// =====================================================

async function getAllResults(options = {}) {
  const {
    approvalStatus,
    category,
    mode,
    round,
  } = options;

  validateMode(mode);

  if (approvalStatus !== undefined) {
    const validStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (!validStatuses.includes(approvalStatus)) {
      const error = new Error(
        "Invalid approval status."
      );

      error.code =
        "INVALID_APPROVAL_STATUS";

      throw error;
    }
  }

  const gameWhere = {};

  if (approvalStatus !== undefined) {
    gameWhere.approvalStatus =
      approvalStatus;
  }

  if (
    category !== undefined &&
    category !== null &&
    String(category).trim() !== ""
  ) {
    gameWhere.category =
      String(category)
        .trim()
        .toLowerCase();
  }

  if (mode) {
    gameWhere.mode = mode;
  }

  if (
    round !== undefined &&
    round !== null &&
    String(round).trim() !== ""
  ) {
    const parsedRound = Number(round);

    if (
      !Number.isInteger(parsedRound) ||
      parsedRound <= 0
    ) {
      const error = new Error(
        "Round must be a positive integer."
      );

      error.code =
        "INVALID_ROUND";

      throw error;
    }

    gameWhere.round = parsedRound;
  }

  const teamWhere = {};

  if (approvalStatus !== undefined) {
    teamWhere.approvalStatus =
      approvalStatus;
  }

  if (mode) {
    teamWhere.teamPairing = {
      mode,
    };
  }

  if (
    round !== undefined &&
    round !== null &&
    String(round).trim() !== ""
  ) {
    const parsedRound = Number(round);

    teamWhere.teamPairing = {
      ...(teamWhere.teamPairing || {}),
      round: parsedRound,
    };
  }

  const [
    gameResults,
    teamGames,
  ] = await Promise.all([
    prisma.gameResult.findMany({
      where: gameWhere,

      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },

        pairing: {
          select: {
            id: true,
            tournamentId: true,

            whitePlayer: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },

            blackPlayer: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
      },

      orderBy: {
        date: "asc",
      },
    }),

    prisma.teamGame.findMany({
      where: teamWhere,

      include: {
        whitePlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },

        teamPairing: {
          select: {
            id: true,
            round: true,
            mode: true,
            teamAId: true,
            teamBId: true,
            availableAt: true,
            createdAt: true,

            teamA: {
              select: {
                id: true,
                name: true,
              },
            },

            teamB: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },

      orderBy: {
        teamPairing: {
          createdAt: "asc",
        },
      },
    }),
  ]);

 
  const formattedGameResults =
    gameResults.map((gameResult) => ({
      id: gameResult.id,

      resultType: "GAME",

      pairingType:
        gameResult.pairing?.tournamentId
          ? "SPECIAL"
          : "NORMAL",

      round: gameResult.round,
      mode: gameResult.mode,

      category:
        gameResult.category || null,

      tournamentId:
        gameResult.pairing?.tournamentId ||
        null,

      eventName: null,

      teamCategory: null,

      whitePlayerId:
        gameResult.whitePlayerId,

      blackPlayerId:
        gameResult.blackPlayerId,

      whitePlayer:
        gameResult.whitePlayer,

      blackPlayer:
        gameResult.blackPlayer,

      whiteScore:
        gameResult.whiteScore,

      blackScore:
        gameResult.blackScore,

      approvalStatus:
        gameResult.approvalStatus,

      approvedAt:
        gameResult.approvedAt,

      rejectionReason:
        gameResult.rejectionReason,

      pairingId:
        gameResult.pairingId,

      teamPairingId: null,

      boardPosition: null,

      teamAId: null,

      teamBId: null,

      teamAName: null,

      teamBName: null,

      teamResult: null,

      createdAt:
        gameResult.date,
    }));

  const formattedTeamGames =
    teamGames.map((teamGame) => ({
      id: teamGame.id,

      resultType: "TEAM",

      pairingType: "TEAM",

      round:
        teamGame.teamPairing.round,

      mode:
        teamGame.teamPairing.mode,

      category: null,

      tournamentId: null,

      eventName: null,

      teamCategory:
        `${teamGame.teamPairing.teamA.name} vs ${teamGame.teamPairing.teamB.name}`,

      whitePlayerId:
        teamGame.whitePlayerId,

      blackPlayerId:
        teamGame.blackPlayerId,

      whitePlayer:
        teamGame.whitePlayer,

      blackPlayer:
        teamGame.blackPlayer,

      whiteScore: null,

      blackScore: null,

      approvalStatus:
        teamGame.approvalStatus,

      approvedAt: null,

      rejectionReason: null,

      pairingId: null,

      teamPairingId:
        teamGame.teamPairingId,

      boardPosition:
        teamGame.boardPosition,

      teamAId:
        teamGame.teamPairing.teamAId,

      teamBId:
        teamGame.teamPairing.teamBId,

      teamAName:
        teamGame.teamPairing.teamA.name,

      teamBName:
        teamGame.teamPairing.teamB.name,

      teamResult: {
        id: teamGame.id,

        result:
          teamGame.result,

        approvalStatus:
          teamGame.approvalStatus,
      },

      createdAt:
        teamGame.teamPairing?.createdAt ?? null,
    }));

  return [
    ...formattedGameResults,
    ...formattedTeamGames,
  ].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() -
      new Date(b.createdAt).getTime()
  );
}

// =====================================================
// APPROVE RESULT
// =====================================================

async function approveResult(resultId) {
  resultId = validateId(
    resultId,
    "result ID"
  );

  return prisma.$transaction(
    async (tx) => {
      const gameResult =
        await tx.gameResult.findUnique({
          where: {
            id: resultId,
          },

          include: {
            whitePlayer: true,
            blackPlayer: true,
            pairing: true,
          },
        });

      if (!gameResult) {
        const error = new Error(
          "Result not found."
        );

        error.code =
          "RESULT_NOT_FOUND";

        throw error;
      }

      if (
        gameResult.approvalStatus !==
        "PENDING"
      ) {
        const error = new Error(
          `Result has already been ${gameResult.approvalStatus.toLowerCase()}.`
        );

        error.code =
          "RESULT_ALREADY_REVIEWED";

        throw error;
      }

      const {
        whiteGain,
        blackGain,
      } = await calculateGains(
        tx,
        gameResult
      );

      const now = new Date();

      const updatedResult =
        await tx.gameResult.update({
          where: {
            id: gameResult.id,
          },

          data: {
            approvalStatus:
              "APPROVED",

            approvedAt:
              now,

            whiteRatingChange:
              whiteGain,

            blackRatingChange:
              blackGain,

            rejectionReason:
              null,
          },
        });

      await tx.ratingGain.createMany({
        data: [
          {
            playerId:
              gameResult.whitePlayerId,

            pairingId:
              gameResult.pairingId,

            tournamentId:
              gameResult.pairing?.tournamentId ||
              null,

            mode:
              gameResult.mode,

            amount:
              whiteGain,

            approvalStatus:
              "APPROVED",

            approvedAt:
              now,

            isApplied:
              false,

            reason:
              `Round ${gameResult.round} result`,
          },

          {
            playerId:
              gameResult.blackPlayerId,

            pairingId:
              gameResult.pairingId,

            tournamentId:
              gameResult.pairing?.tournamentId ||
              null,

            mode:
              gameResult.mode,

            amount:
              blackGain,

            approvalStatus:
              "APPROVED",

            approvedAt:
              now,

            isApplied:
              false,

            reason:
              `Round ${gameResult.round} result`,
          },
        ],
      });

      return updatedResult;
    }
  );
}


// =====================================================
// REJECT RESULT
// =====================================================

async function rejectResult(
  resultId,
  reason
) {
  resultId = validateId(
    resultId,
    "result ID"
  );

  if (
    reason !== undefined &&
    reason !== null &&
    typeof reason !== "string"
  ) {
    const error = new Error(
      "Rejection reason must be a string."
    );

    error.code =
      "INVALID_REJECTION_REASON";

    throw error;
  }

  const cleanReason =
    typeof reason === "string"
      ? reason.trim()
      : null;

  if (
    cleanReason &&
    cleanReason.length > 1000
  ) {
    const error = new Error(
      "Rejection reason is too long."
    );

    error.code =
      "REJECTION_REASON_TOO_LONG";

    throw error;
  }

  return prisma.$transaction(
    async (tx) => {
      const gameResult =
        await tx.gameResult.findUnique({
          where: {
            id: resultId,
          },
        });

      if (!gameResult) {
        const error = new Error(
          "Result not found."
        );

        error.code =
          "RESULT_NOT_FOUND";

        throw error;
      }

      if (
        gameResult.approvalStatus !==
        "PENDING"
      ) {
        const error = new Error(
          `Result has already been ${gameResult.approvalStatus.toLowerCase()}.`
        );

        error.code =
          "RESULT_ALREADY_REVIEWED";

        throw error;
      }

      return tx.gameResult.update({
        where: {
          id: resultId,
        },

        data: {
          approvalStatus:
            "REJECTED",

          rejectionReason:
            cleanReason,

          approvedAt:
            null,

          whiteRatingChange:
            null,

          blackRatingChange:
            null,
        },
      });
    }
  );
}


// =====================================================
// RECALCULATE EDITED RESULT GAINS
// =====================================================

async function recalculateEditedResultGains(
  resultId,
  resultType = "GAME"
) {
  resultId = validateId(
    resultId,
    "result ID"
  );

  resultType = String(resultType)
    .trim()
    .toUpperCase();

  if (
    resultType !== "GAME" &&
    resultType !== "TEAM"
  ) {
    const error = new Error(
      "Invalid result type. Use GAME or TEAM."
    );

    error.code =
      "INVALID_RESULT_TYPE";

    throw error;
  }

  return prisma.$transaction(
    async (tx) => {

      if (resultType === "GAME") {
        const gameResult =
          await tx.gameResult.findUnique({
            where: {
              id: resultId,
            },

            include: {
              whitePlayer: true,
              blackPlayer: true,
              pairing: true,
            },
          });

        if (!gameResult) {
          const error = new Error(
            "Game result not found."
          );

          error.code =
            "RESULT_NOT_FOUND";

          throw error;
        }

        if (
          gameResult.approvalStatus !==
          "APPROVED"
        ) {
          return {
            result: gameResult,
            ratingGains: [],
          };
        }

        const gains =
          await tx.ratingGain.findMany({
            where: {
              pairingId:
                gameResult.pairingId,

              playerId: {
                in: [
                  gameResult.whitePlayerId,
                  gameResult.blackPlayerId,
                ],
              },
            },

            orderBy: {
              id: "asc",
            },
          });

        const whiteRatingGain =
          gains.find(
            (gain) =>
              gain.playerId ===
              gameResult.whitePlayerId
          );

        const blackRatingGain =
          gains.find(
            (gain) =>
              gain.playerId ===
              gameResult.blackPlayerId
          );

        const reverseAppliedGain =
          async (gain) => {
            if (
              !gain ||
              !gain.isApplied
            ) {
              return;
            }

            await tx.player.update({
              where: {
                id: gain.playerId,
              },

              data: getRatingUpdate(
                gain.mode,
                -gain.amount
              ),
            });
          };

        await reverseAppliedGain(
          whiteRatingGain
        );

        await reverseAppliedGain(
          blackRatingGain
        );

        const whitePlayer =
          await tx.player.findUnique({
            where: {
              id:
                gameResult.whitePlayerId,
            },
          });

        const blackPlayer =
          await tx.player.findUnique({
            where: {
              id:
                gameResult.blackPlayerId,
            },
          });

        if (
          !whitePlayer ||
          !blackPlayer
        ) {
          const error = new Error(
            "Game result players not found."
          );

          error.code =
            "PLAYER_NOT_FOUND";

          throw error;
        }

        const recalculationResult =
          await calculateGains(
            tx,
            {
              ...gameResult,
              whitePlayer,
              blackPlayer,
            }
          );

        const {
          whiteGain,
          blackGain,
        } = recalculationResult;

        let updatedWhiteGain;

        if (whiteRatingGain) {
          updatedWhiteGain =
            await tx.ratingGain.update({
              where: {
                id:
                  whiteRatingGain.id,
              },

              data: {
                amount:
                  whiteGain,

                approvalStatus:
                  "APPROVED",

                approvedAt:
                  whiteRatingGain.approvedAt ||
                  gameResult.approvedAt ||
                  new Date(),

                isApplied:
                  false,

                appliedAt:
                  null,
              },
            });
        } else {
          updatedWhiteGain =
            await tx.ratingGain.create({
              data: {
                playerId:
                  gameResult.whitePlayerId,

                pairingId:
                  gameResult.pairingId,

                tournamentId:
                  gameResult.pairing
                    ?.tournamentId ||
                  null,

                mode:
                  gameResult.mode,

                amount:
                  whiteGain,

                approvalStatus:
                  "APPROVED",

                approvedAt:
                  gameResult.approvedAt ||
                  new Date(),

                isApplied:
                  false,

                reason:
                  `Round ${gameResult.round} result`,
              },
            });
        }

        let updatedBlackGain;

        if (blackRatingGain) {
          updatedBlackGain =
            await tx.ratingGain.update({
              where: {
                id:
                  blackRatingGain.id,
              },

              data: {
                amount:
                  blackGain,

                approvalStatus:
                  "APPROVED",

                approvedAt:
                  blackRatingGain.approvedAt ||
                  gameResult.approvedAt ||
                  new Date(),

                isApplied:
                  false,

                appliedAt:
                  null,
              },
            });
        } else {
          updatedBlackGain =
            await tx.ratingGain.create({
              data: {
                playerId:
                  gameResult.blackPlayerId,

                pairingId:
                  gameResult.pairingId,

                tournamentId:
                  gameResult.pairing
                    ?.tournamentId ||
                  null,

                mode:
                  gameResult.mode,

                amount:
                  blackGain,

                approvalStatus:
                  "APPROVED",

                approvedAt:
                  gameResult.approvedAt ||
                  new Date(),

                isApplied:
                  false,

                reason:
                  `Round ${gameResult.round} result`,
              },
            });
        }

        
        const updatedResult =
          await tx.gameResult.update({
            where: {
              id:
                gameResult.id,
            },

            data: {
              whiteRatingChange:
                whiteGain,

              blackRatingChange:
                blackGain,
            },
          });

        return {
          result: updatedResult,

          ratingGains: [
            updatedWhiteGain,
            updatedBlackGain,
          ],
        };
      }

      const teamGame =
        await tx.teamGame.findUnique({
          where: {
            id: resultId,
          },

          include: {
            teamPairing: true,
            whitePlayer: true,
            blackPlayer: true,
          },
        });

      if (!teamGame) {
        const error = new Error(
          "Team game not found."
        );

        error.code =
          "RESULT_NOT_FOUND";

        throw error;
      }

      if (
        teamGame.approvalStatus !==
        "APPROVED"
      ) {
        return {
          result: teamGame,
          ratingGains: [],
        };
      }

      const gains =
        await tx.ratingGain.findMany({
          where: {
            teamGameId:
              teamGame.id,

            playerId: {
              in: [
                teamGame.whitePlayerId,
                teamGame.blackPlayerId,
              ],
            },
          },

          orderBy: {
            id: "asc",
          },
        });

      const whiteRatingGain =
        gains.find(
          (gain) =>
            gain.playerId ===
            teamGame.whitePlayerId
        );

      const blackRatingGain =
        gains.find(
          (gain) =>
            gain.playerId ===
            teamGame.blackPlayerId
        );

      const reverseAppliedGain =
        async (gain) => {
          if (
            !gain ||
            !gain.isApplied
          ) {
            return;
          }

          await tx.player.update({
            where: {
              id: gain.playerId,
            },

            data: getRatingUpdate(
              gain.mode,
              -gain.amount
            ),
          });
        };

      await reverseAppliedGain(
        whiteRatingGain
      );

      await reverseAppliedGain(
        blackRatingGain
      );

      const whitePlayer =
        await tx.player.findUnique({
          where: {
            id:
              teamGame.whitePlayerId,
          },
        });

      const blackPlayer =
        await tx.player.findUnique({
          where: {
            id:
              teamGame.blackPlayerId,
          },
        });

      if (
        !whitePlayer ||
        !blackPlayer
      ) {
        const error = new Error(
          "Team game players not found."
        );

        error.code =
          "PLAYER_NOT_FOUND";

        throw error;
      }

      const {
        whiteGain,
        blackGain,
      } =
        await calculateTeamGameGains(
          tx,
          {
            ...teamGame,
            whitePlayer,
            blackPlayer,
          }
        );

      let updatedWhiteGain;

      if (whiteRatingGain) {
        updatedWhiteGain =
          await tx.ratingGain.update({
            where: {
              id:
                whiteRatingGain.id,
            },

            data: {
              amount:
                whiteGain,

              approvalStatus:
                "APPROVED",

              approvedAt:
                whiteRatingGain.approvedAt ||
                teamGame.approvedAt ||
                new Date(),

              isApplied:
                false,

              appliedAt:
                null,
            },
          });
      } else {
        updatedWhiteGain =
          await tx.ratingGain.create({
            data: {
              playerId:
                teamGame.whitePlayerId,

              teamGameId:
                teamGame.id,

              tournamentId:
                null,

              mode:
                teamGame.teamPairing.mode,

              amount:
                whiteGain,

              approvalStatus:
                "APPROVED",

              approvedAt:
                teamGame.approvedAt ||
                new Date(),

              isApplied:
                false,

              reason:
                `Team round ${teamGame.teamPairing.round} result`,
            },
          });
      }

      let updatedBlackGain;

      if (blackRatingGain) {
        updatedBlackGain =
          await tx.ratingGain.update({
            where: {
              id:
                blackRatingGain.id,
            },

            data: {
              amount:
                blackGain,

              approvalStatus:
                "APPROVED",

              approvedAt:
                blackRatingGain.approvedAt ||
                teamGame.approvedAt ||
                new Date(),

              isApplied:
                false,

              appliedAt:
                null,
            },
          });
      } else {
        updatedBlackGain =
          await tx.ratingGain.create({
            data: {
              playerId:
                teamGame.blackPlayerId,

              teamGameId:
                teamGame.id,

              tournamentId:
                null,

              mode:
                teamGame.teamPairing.mode,

              amount:
                blackGain,

              approvalStatus:
                "APPROVED",

              approvedAt:
                teamGame.approvedAt ||
                new Date(),

              isApplied:
                false,

              reason:
                `Team round ${teamGame.teamPairing.round} result`,
            },
          });
      }
      
      const updatedTeamGame =
        await tx.teamGame.findUnique({
          where: {
            id:
              teamGame.id,
          },

          include: {
            teamPairing: true,
            whitePlayer: true,
            blackPlayer: true,
          },
        });

      return {
        result:
          updatedTeamGame,

        ratingGains: [
          updatedWhiteGain,
          updatedBlackGain,
        ],
      };
    }
  );
}

// =====================================================
// APPLY RATING GAIN
// =====================================================

async function applyRatingGain(ratingGainId) {
  ratingGainId = validateId(ratingGainId, "rating gain ID");

  return prisma.$transaction(async (tx) => {
    const gain = await tx.ratingGain.findUnique({
      where: { id: ratingGainId },
    });

    if (!gain) {
      const error = new Error("Rating gain not found.");
      error.code = "RATING_GAIN_NOT_FOUND";
      throw error;
    }

    if (gain.isApplied) {
      const player = await tx.player.findUnique({
        where: { id: gain.playerId },
        select: {
          id: true,
          username: true,
          rapidRating: true,
          blitzRating: true,
          bulletRating: true,
          rapidGain: true,
          blitzGain: true,
          bulletGain: true,
        },
      });

      return {
        ratingGain: gain,
        player,
        alreadyApplied: true,
      };
    }

    if (gain.approvalStatus !== "APPROVED") {
      const error = new Error(
        "Rating gain must be approved before it can be applied."
      );
      error.code = "RATING_GAIN_NOT_APPROVED";
      throw error;
    }

    await tx.player.update({
      where: {
        id: gain.playerId,
      },
      data: getRatingUpdate(
        gain.mode,
        gain.amount
      ),
    });

    const updatedGain =
      await tx.ratingGain.update({
        where: {
          id: gain.id,
        },
        data: {
          isApplied: true,
          appliedAt: new Date(),
        },
      });

    const player = await tx.player.findUnique({
      where: {
        id: gain.playerId,
      },
      select: {
        id: true,
        username: true,
        rapidRating: true,
        blitzRating: true,
        bulletRating: true,
        rapidGain: true,
        blitzGain: true,
        bulletGain: true,
      },
    });

    return {
      ratingGain: updatedGain,
      player,
      alreadyApplied: false,
    };
  });
}


// =====================================================
// AUTO APPLY
// =====================================================

async function autoApplyPendingRatingGains() {
  const sevenDaysAgo =
    new Date(
      Date.now() -
        7 *
          24 *
          60 *
          60 *
          1000
    );

  const gains =
    await prisma.ratingGain.findMany({
      where: {
        approvalStatus:
          "APPROVED",

        isApplied:
          false,

        approvedAt: {
          lte:
            sevenDaysAgo,
        },
      },

      select: {
        id: true,
      },
    });

  let applied = 0;

  for (const gain of gains) {
    try {
      await applyRatingGain(
        gain.id
      );

      applied++;
    } catch (error) {
      console.error(
        `AUTO APPLY RATING GAIN ${gain.id} ERROR:`,
        error
      );
    }
  }

  return {
    found:
      gains.length,

    applied,
  };
}

// =====================================================
// APPROVE TEAM GAME
// =====================================================

async function approveTeamGame(teamGameId) {
  teamGameId = validateId(teamGameId, "team game ID");

  return prisma.$transaction(async (tx) => {
    const teamGame = await tx.teamGame.findUnique({
      where: { id: teamGameId },
      include: {
        teamPairing: true,
        whitePlayer: true,
        blackPlayer: true,
      },
    });

    if (!teamGame) {
      const error = new Error("Team game not found.");
      error.code = "TEAM_GAME_NOT_FOUND";
      throw error;
    }

    if (teamGame.approvalStatus !== "PENDING") {
      const error = new Error("Team game has already been processed.");
      error.code = "TEAM_GAME_ALREADY_PROCESSED";
      throw error;
    }

    const { whiteGain, blackGain } =
      await calculateTeamGameGains(tx, teamGame);

    const approvedAt = new Date();

    const updatedTeamGame = await tx.teamGame.update({
      where: { id: teamGame.id },
      data: {
        approvalStatus: "APPROVED",
        approvedAt,
      },
    });

    await tx.ratingGain.createMany({
      data: [
        {
          playerId: teamGame.whitePlayerId,
          teamGameId: teamGame.id,
          tournamentId: null,
          mode: teamGame.teamPairing.mode,
          amount: whiteGain,
          approvalStatus: "APPROVED",
          approvedAt,
          isApplied: false,
          reason: `Team round ${teamGame.teamPairing.round} result`,
        },
        {
          playerId: teamGame.blackPlayerId,
          teamGameId: teamGame.id,
          tournamentId: null,
          mode: teamGame.teamPairing.mode,
          amount: blackGain,
          approvalStatus: "APPROVED",
          approvedAt,
          isApplied: false,
          reason: `Team round ${teamGame.teamPairing.round} result`,
        },
      ],
    });

    return updatedTeamGame;
  });
}

// =====================================================
// REJECT TEAM GAME
// =====================================================

async function rejectTeamGame(
  teamGameId,
  reason
) {
  const id = validateId(
    teamGameId,
    "Team game ID"
  );

  if (
    reason !== undefined &&
    reason !== null &&
    String(reason).trim().length > 1000
  ) {
    const error = new Error(
      "Rejection reason must not exceed 1000 characters."
    );

    error.code =
      "INVALID_REJECTION_REASON";

    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const teamGame =
      await tx.teamGame.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          approvalStatus: true,
        },
      });

    if (!teamGame) {
      const error = new Error(
        "Team game not found."
      );

      error.code =
        "TEAM_GAME_NOT_FOUND";

      throw error;
    }

    if (
      teamGame.approvalStatus !==
      "PENDING"
    ) {
      const error = new Error(
        `Team game is already ${teamGame.approvalStatus.toLowerCase()}.`
      );

      error.code =
        "TEAM_GAME_ALREADY_PROCESSED";

      throw error;
    }

    const updated =
      await tx.teamGame.update({
        where: {
          id,
        },

        data: {
          approvalStatus:
            "REJECTED",
        },

        include: {
          teamPairing: {
            include: {
              teamA: {
                select: {
                  id: true,
                  name: true,
                },
              },

              teamB: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          whitePlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },

          blackPlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
      });

    return updated;
  });
}

async function getPendingRatingGains() {
  return prisma.ratingGain.findMany({
    where: {
      approvalStatus: "APPROVED",
      isApplied: false,
    },

    orderBy: {
      createdAt: "asc",
    },

    select: {
      id: true,
      playerId: true,

      pairingId: true,
      teamGameId: true,
      tournamentId: true,

      approvalStatus: true,
      approvedAt: true,
      approvedByAdminId: true,

      appliedAt: true,

      mode: true,
      amount: true,
      isApplied: true,

      reason: true,
      createdAt: true,
    },
  });
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getAllResults,
  approveResult,
  rejectResult,
  approveTeamGame,
  rejectTeamGame,
  recalculateEditedResultGains,
  applyRatingGain,
  autoApplyPendingRatingGains,
  getPendingRatingGains,
};