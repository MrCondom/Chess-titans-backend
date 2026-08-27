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
  const whiteRating = getPlayerRating(
    gameResult.whitePlayer,
    gameResult.mode
  );

  const blackRating = getPlayerRating(
    gameResult.blackPlayer,
    gameResult.mode
  );

  const {
    changeA,
    changeB,
  } = calculateRatingChange(
    whiteRating,
    blackRating,
    gameResult.whiteScore,
    gameResult.blackScore
  );

  const previousResults =
    await tx.gameResult.findMany({
      where: {
        approvalStatus: "APPROVED",

        id: {
          not: gameResult.id,
        },

        OR: [
          {
            whitePlayerId:
              gameResult.whitePlayerId,
          },
          {
            blackPlayerId:
              gameResult.whitePlayerId,
          },
          {
            whitePlayerId:
              gameResult.blackPlayerId,
          },
          {
            blackPlayerId:
              gameResult.blackPlayerId,
          },
        ],
      },

      orderBy: {
        date: "asc",
      },
    });

  const whiteMultiplier =
    calculateStreakMultiplier(
      previousResults,
      gameResult.whitePlayerId,
      gameResult.mode,
      gameResult.category,
      changeA
    );

  const blackMultiplier =
    calculateStreakMultiplier(
      previousResults,
      gameResult.blackPlayerId,
      gameResult.mode,
      gameResult.category,
      changeB
    );

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

  const where = {};

  // ---------------------------------------------
  // Approval status
  // ---------------------------------------------

  if (approvalStatus !== undefined) {
    const validStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      !validStatuses.includes(
        approvalStatus
      )
    ) {
      const error = new Error(
        "Invalid approval status."
      );

      error.code =
        "INVALID_APPROVAL_STATUS";

      throw error;
    }

    where.approvalStatus =
      approvalStatus;
  }

  // ---------------------------------------------
  // Category
  // ---------------------------------------------

  if (
    category !== undefined &&
    category !== null &&
    String(category).trim() !== ""
  ) {
    where.category =
      String(category)
        .trim()
        .toLowerCase();
  }

  // ---------------------------------------------
  // Mode
  // ---------------------------------------------

  if (mode) {
    where.mode = mode;
  }

  // ---------------------------------------------
  // Round
  // ---------------------------------------------

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

    where.round = parsedRound;
  }

  return prisma.gameResult.findMany({
    where,

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
  });
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

  // ---------------------------------------------
  // Validate reason
  // ---------------------------------------------

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
  resultId
) {
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
        "APPROVED"
      ) {
        return gameResult;
      }

      const {
        whiteGain,
        blackGain,
      } = await calculateGains(
        tx,
        gameResult
      );

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

            isApplied: false,
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

      if (whiteRatingGain) {
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
              new Date(),

            isApplied:
              false,

            appliedAt:
              null,
          },
        });
      }

      if (blackRatingGain) {
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
              new Date(),

            isApplied:
              false,

            appliedAt:
              null,
          },
        });
      }

      return tx.gameResult.update({
        where: {
          id: gameResult.id,
        },

        data: {
          whiteRatingChange:
            whiteGain,

          blackRatingChange:
            blackGain,
        },
      });
    }
  );
}


// =====================================================
// APPLY RATING GAIN
// =====================================================

async function applyRatingGain(
  ratingGainId
) {
  ratingGainId = validateId(
    ratingGainId,
    "rating gain ID"
  );

  return prisma.$transaction(
    async (tx) => {
      const gain =
        await tx.ratingGain.findUnique({
          where: {
            id: ratingGainId,
          },
        });

      if (!gain) {
        const error = new Error(
          "Rating gain not found."
        );

        error.code =
          "RATING_GAIN_NOT_FOUND";

        throw error;
      }

      if (gain.isApplied) {
        return gain;
      }

      if (
        gain.approvalStatus !==
        "APPROVED"
      ) {
        const error = new Error(
          "Rating gain is not approved."
        );

        error.code =
          "RATING_GAIN_NOT_APPROVED";

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

      return tx.ratingGain.update({
        where: {
          id: gain.id,
        },

        data: {
          isApplied:
            true,

          appliedAt:
            new Date(),
        },
      });
    }
  );
}


// =====================================================
// RATING UPDATE
// =====================================================

function getRatingUpdate(
  mode,
  amount
) {
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
// EXPORTS
// =====================================================

module.exports = {
  getAllResults,
  approveResult,
  rejectResult,
  recalculateEditedResultGains,
  applyRatingGain,
  autoApplyPendingRatingGains,
};