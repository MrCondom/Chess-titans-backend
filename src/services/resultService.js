const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");


function validateMode(mode) {
  const validModes = ["RAPID", "BLITZ", "BULLET"];

  if (!validModes.includes(mode)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }
}


function validateScore(score) {
  const value = Number(score);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid score.");
  }

  return value;
}


async function getPairingForResult(tx, pairingId) {
  const pairing = await tx.pairing.findUnique({
    where: {
      id: pairingId,
    },

    include: {
      whitePlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },

      blackPlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },

      result: true,
    },
  });

  if (!pairing) {
    const error = new Error("Pairing not found.");
    error.code = "PAIRING_NOT_FOUND";

    throw error;
  }

  return pairing;
}


async function submitResult({
  pairingId,
  playerId,
  whiteScore,
  blackScore,
}) {
  pairingId = Number(pairingId);
  playerId = Number(playerId);

  if (
    !Number.isInteger(pairingId) ||
    pairingId <= 0
  ) {
    throw new Error("Invalid pairing ID.");
  }

  if (
    !Number.isInteger(playerId) ||
    playerId <= 0
  ) {
    throw new Error("Invalid player ID.");
  }

  const whiteScoreValue = validateScore(whiteScore);
  const blackScoreValue = validateScore(blackScore);

  if (whiteScoreValue === blackScoreValue) {
    // Draw is allowed.
  }

  const result = await prisma.$transaction(async (tx) => {
    const pairing = await getPairingForResult(
      tx,
      pairingId
    );

    const isParticipant =
      pairing.whitePlayerId === playerId ||
      pairing.blackPlayerId === playerId;

    if (!isParticipant) {
      const error = new Error(
        "You are not authorized to submit a result for this pairing."
      );

      error.code = "NOT_PAIRING_PARTICIPANT";

      throw error;
    }

    if (pairing.result) {
      const error = new Error(
        "A result has already been submitted for this pairing."
      );

      error.code = "RESULT_ALREADY_EXISTS";

      throw error;
    }

    const createdResult =
      await tx.gameResult.create({
        data: {
          round: pairing.round,
          mode: pairing.mode,

          whitePlayerId: pairing.whitePlayerId,
          blackPlayerId: pairing.blackPlayerId,

          whiteScore: whiteScoreValue,
          blackScore: blackScoreValue,

          category: pairing.category,

          approvalStatus: "PENDING",

          pairingId: pairing.id,
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

    return createdResult;
  });

  // Notify both players that the result is awaiting approval.
  try {
    await Promise.all([
      notificationService.createNotification({
        playerId: result.whitePlayerId,
        type: "RESULT",
        title: "Result Submitted",
        message:
          `The result for Round ${result.round} ` +
          `(${result.mode}) has been submitted and is awaiting approval.`,
      }),

      notificationService.createNotification({
        playerId: result.blackPlayerId,
        type: "RESULT",
        title: "Result Submitted",
        message:
          `The result for Round ${result.round} ` +
          `(${result.mode}) has been submitted and is awaiting approval.`,
      }),
    ]);
  } catch (error) {
    // Notification failure should not invalidate
    // an already-created game result.
    console.error(
      "RESULT SUBMISSION NOTIFICATION ERROR:",
      error
    );
  }

  return result;
}


async function getResultById(resultId) {
  resultId = Number(resultId);

  if (
    !Number.isInteger(resultId) ||
    resultId <= 0
  ) {
    throw new Error("Invalid result ID.");
  }

  return prisma.gameResult.findUnique({
    where: {
      id: resultId,
    },

    include: {
      whitePlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },

      blackPlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
          category: true,
        },
      },

      pairing: true,
    },
  });
}


async function getPlayerResults(
  playerId,
  options = {}
) {
  playerId = Number(playerId);

  if (
    !Number.isInteger(playerId) ||
    playerId <= 0
  ) {
    throw new Error("Invalid player ID.");
  }

  const where = {
    OR: [
      {
        whitePlayerId: playerId,
      },
      {
        blackPlayerId: playerId,
      },
    ],
  };

  if (options.mode) {
    validateMode(options.mode);
    where.mode = options.mode;
  }

  if (
    options.round !== undefined &&
    options.round !== null
  ) {
    const round = Number(options.round);

    if (
      !Number.isInteger(round) ||
      round <= 0
    ) {
      throw new Error("Invalid round.");
    }

    where.round = round;
  }

  if (options.category) {
    where.category = options.category;
  }

  if (options.approvalStatus) {
    const validStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      !validStatuses.includes(
        options.approvalStatus
      )
    ) {
      throw new Error(
        "Invalid approval status."
      );
    }

    where.approvalStatus =
      options.approvalStatus;
  }

  return prisma.gameResult.findMany({
    where,

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

    orderBy: {
      date: "desc",
    },
  });
}

async function getAllResults(filters = {}) {
  const where = {};

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.mode) {
    validateMode(filters.mode);
    where.mode = filters.mode;
  }

  if (
    filters.round !== undefined &&
    filters.round !== null
  ) {
    const round = Number(filters.round);

    if (
      !Number.isInteger(round) ||
      round <= 0
    ) {
      throw new Error("Invalid round.");
    }

    where.round = round;
  }

  if (filters.approvalStatus) {
    const validStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      !validStatuses.includes(
        filters.approvalStatus
      )
    ) {
      throw new Error(
        "Invalid approval status."
      );
    }

    where.approvalStatus =
      filters.approvalStatus;
  }

  return prisma.gameResult.findMany({
    where,

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

    orderBy: [
      {
        date: "desc",
      },

      {
        id: "desc",
      },
    ],
  });
}


module.exports = {
  submitResult,
  getResultById,
  getPlayerResults,
  getAllResults,
};