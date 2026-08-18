const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");

const {
  calculateRatingChange,
} = require("../utils/ratingCalculator");

const { getResultPoints } = require("../utils/rankingsCalculator");

const { getWinStreak, getLossStreak, getWinMultiplier, getLossMultiplier
} = require("../utils/streak");



function getPlayerRating(player, mode) {
  switch (mode) {
    case "RAPID":
      return player.rapidRating;

    case "BLITZ":
      return player.blitzRating;

    case "BULLET":
      return player.bulletRating;

    default:
      throw new Error(
        "Invalid game mode."
      );
  }
}

function getRatingUpdate(
  mode,
  newRating,
  change
) {
  switch (mode) {
    case "RAPID":
      return {
        rapidRating: newRating,
        rapidGain: {
          increment: change,
        },
      };

    case "BLITZ":
      return {
        blitzRating: newRating,
        blitzGain: {
          increment: change,
        },
      };

    case "BULLET":
      return {
        bulletRating: newRating,
        bulletGain: {
          increment: change,
        },
      };

    default:
      throw new Error(
        "Invalid game mode."
      );
  }
}

function getResultPoints(
  playerScore,
  opponentScore
) {
  if (playerScore > opponentScore) {
    return 1;
  }

  if (playerScore === opponentScore) {
    return 0.5;
  }

  return 0;
}

async function approveResult(resultId) {
  resultId = Number(resultId);

  if (
    !Number.isInteger(resultId) ||
    resultId <= 0
  ) {
    throw new Error("Invalid result ID.");
  }

  const result = await prisma.$transaction(
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
        const error =
          new Error("Result not found.");

        error.code = "RESULT_NOT_FOUND";

        throw error;
      }

      if (
        gameResult.approvalStatus !==
        "PENDING"
      ) {
        const error = new Error(
          `Result has already been ${gameResult.approvalStatus.toLowerCase()}.`
        );

        error.code = "RESULT_ALREADY_REVIEWED";

        throw error;
      }

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

      const {
        changeA,
        changeB,
      } = calculateRatingChange(
        whiteRating,
        blackRating,
        gameResult.whiteScore,
        gameResult.blackScore
      );

      const whiteNewRating =
        Math.max(0, whiteRating + changeA);

      const blackNewRating =
        Math.max(0, blackRating + changeB);

      // Update white player
      await tx.player.update({
        where: {
          id: gameResult.whitePlayerId,
        },

        data: {
          ...getRatingUpdate(
            gameResult.mode,
            whiteNewRating,
            changeA
          ),

          totalPoints: {
            increment:
              getResultPoints(
                gameResult.whiteScore,
                gameResult.blackScore
              ),
          },

          totalRounds: {
            increment: 1,
          },
        },
      });

      // Update black player
      await tx.player.update({
        where: {
          id: gameResult.blackPlayerId,
        },

        data: {
          ...getRatingUpdate(
            gameResult.mode,
            blackNewRating,
            changeB
          ),

          totalPoints: {
            increment:
              getResultPoints(
                gameResult.blackScore,
                gameResult.whiteScore
              ),
          },

          totalRounds: {
            increment: 1,
          },
        },
      });

      // Save rating changes on the result
      const updatedResult =
        await tx.gameResult.update({
          where: {
            id: gameResult.id,
          },

          data: {
            approvalStatus: "APPROVED",

            approvedAt: new Date(),

            rejectionReason: null,

            whiteRatingChange: changeA,

            blackRatingChange: changeB,
          },

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

            pairing: true,
          },
        });

      // Rating history — white
      await tx.ratingGain.create({
        data: {
          playerId:
            gameResult.whitePlayerId,

          pairingId:
            gameResult.pairingId,

          mode:
            gameResult.mode,

          amount: changeA,

          reason:
            `Round ${gameResult.round} result`,
        },
      });

      // Rating history — black
      await tx.ratingGain.create({
        data: {
          playerId:
            gameResult.blackPlayerId,

          pairingId:
            gameResult.pairingId,

          mode:
            gameResult.mode,

          amount: changeB,

          reason:
            `Round ${gameResult.round} result`,
        },
      });

      return updatedResult;
    }
  );

  // Notifications happen AFTER the transaction.
  try {
    await Promise.all([
      notificationService.createNotification({
        playerId:
          result.whitePlayerId,

        type: "RESULT",

        title: "Result Approved",

        message:
          `Your Round ${result.round} ` +
          `(${result.mode}) result has been approved. ` +
          `Rating change: ${
            result.whiteRatingChange >= 0
              ? "+"
              : ""
          }${result.whiteRatingChange}.`,
      }),

      notificationService.createNotification({
        playerId:
          result.blackPlayerId,

        type: "RESULT",

        title: "Result Approved",

        message:
          `Your Round ${result.round} ` +
          `(${result.mode}) result has been approved. ` +
          `Rating change: ${
            result.blackRatingChange >= 0
              ? "+"
              : ""
          }${result.blackRatingChange}.`,
      }),
    ]);
  } catch (error) {
    console.error(
      "RESULT APPROVAL NOTIFICATION ERROR:",
      error
    );
  }

  return result;
}


async function rejectResult(
  resultId,
  reason
) {
  resultId = Number(resultId);

  if (
    !Number.isInteger(resultId) ||
    resultId <= 0
  ) {
    throw new Error("Invalid result ID.");
  }

  const cleanReason =
    typeof reason === "string"
      ? reason.trim()
      : "";

  if (!cleanReason) {
    throw new Error(
      "A rejection reason is required."
    );
  }

  const result =
    await prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.gameResult.findUnique({
            where: {
              id: resultId,
            },

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

              pairing: true,
            },
          });

        if (!existing) {
          const error =
            new Error(
              "Result not found."
            );

          error.code =
            "RESULT_NOT_FOUND";

          throw error;
        }

        if (
          existing.approvalStatus !==
          "PENDING"
        ) {
          const error =
            new Error(
              `Result has already been ${existing.approvalStatus.toLowerCase()}.`
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
            approvalStatus: "REJECTED",
            rejectionReason: cleanReason
          },

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

            pairing: true,
          },
        });
      }
    );

  try {
    await Promise.all([
      notificationService.createNotification({
        playerId:
          result.whitePlayerId,

        type: "REJECTION",

        title: "Result Rejected",

        message:
          `The result for Round ${result.round} ` +
          `(${result.mode}) was rejected. ` +
          `Reason: ${cleanReason}`,
      }),

      notificationService.createNotification({
        playerId:
          result.blackPlayerId,

        type: "REJECTION",

        title: "Result Rejected",

        message:
          `The result for Round ${result.round} ` +
          `(${result.mode}) was rejected. ` +
          `Reason: ${cleanReason}`,
      }),
    ]);
  } catch (error) {
    console.error(
      "RESULT REJECTION NOTIFICATION ERROR:",
      error
    );
  }

  return result;
}

Exports
module.exports = {
  submitResult,
  getResultById,
  getPlayerResults,
  getAllResults,
  approveResult,
  rejectResult,
};
