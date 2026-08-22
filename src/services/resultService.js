const prisma = require("../lib/prisma");

async function createResult({
  pairingId,
  whiteScore,
  blackScore,
}) {
  pairingId = Number(pairingId);

  if (!Number.isInteger(pairingId) || pairingId <= 0) {
    throw new Error("Invalid pairing ID.");
  }

  const white = Number(whiteScore);
  const black = Number(blackScore);

  if (!Number.isFinite(white) || white < 0) {
    throw new Error("Invalid white score.");
  }

  if (!Number.isFinite(black) || black < 0) {
    throw new Error("Invalid black score.");
  }

  return prisma.$transaction(async (tx) => {
    const pairing = await tx.pairing.findUnique({
      where: {
        id: pairingId,
      },
    });

    if (!pairing) {
      const error = new Error("Pairing not found.");
      error.code = "PAIRING_NOT_FOUND";
      throw error;
    }

    const existingResult = await tx.gameResult.findUnique({
      where: {
        pairingId,
      },
    });

    if (existingResult) {
      const error = new Error(
        "A result already exists for this pairing."
      );
      error.code = "RESULT_ALREADY_EXISTS";
      throw error;
    }

    const result = await tx.gameResult.create({
      data: {
        round: pairing.round,
        mode: pairing.mode,

        whitePlayerId: pairing.whitePlayerId,
        blackPlayerId: pairing.blackPlayerId,

        whiteScore: white,
        blackScore: black,

        category: pairing.category,

        pairingId: pairing.id,

        approvalStatus: "APPROVED",
        approvedAt: new Date(),
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

    return result;
  });
}

async function updateResult({
  resultId,
  whiteScore,
  blackScore,
}) {
  resultId = Number(resultId);

  if (!Number.isInteger(resultId) || resultId <= 0) {
    throw new Error("Invalid result ID.");
  }

  const white = Number(whiteScore);
  const black = Number(blackScore);

  if (!Number.isFinite(white) || white < 0) {
    throw new Error("Invalid white score.");
  }

  if (!Number.isFinite(black) || black < 0) {
    throw new Error("Invalid black score.");
  }

  const result = await prisma.gameResult.findUnique({
    where: {
      id: resultId,
    },
  });

  if (!result) {
    const error = new Error("Result not found.");
    error.code = "RESULT_NOT_FOUND";
    throw error;
  }

  return prisma.gameResult.update({
    where: {
      id: resultId,
    },

    data: {
      whiteScore: white,
      blackScore: black,
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

async function deleteResult(resultId) {
  resultId = Number(resultId);

  if (!Number.isInteger(resultId) || resultId <= 0) {
    throw new Error("Invalid result ID.");
  }

  const result = await prisma.gameResult.findUnique({
    where: {
      id: resultId,
    },
  });

  if (!result) {
    const error = new Error("Result not found.");
    error.code = "RESULT_NOT_FOUND";
    throw error;
  }

  await prisma.gameResult.delete({
    where: {
      id: resultId,
    },
  });

  return result;
}

async function deleteAllResults() {
  return prisma.$transaction(async (tx) => {
    const totalPairings = await tx.pairing.count();

    const completedPairings = await tx.pairing.count({
      where: {
        result: {
          isNot: null,
        },
      },
    });

    if (totalPairings !== completedPairings) {
      const error = new Error(
        "Cannot delete all results. Not all pairings are finished."
      );

      error.code = "PAIRINGS_NOT_FINISHED";

      throw error;
    }

    const totalResults = await tx.gameResult.count();

    await tx.gameResult.deleteMany({});

    return {
      deletedResults: totalResults,
    };
  });
}

module.exports = {
  createResult,
  updateResult,
  deleteResult,
  deleteAllResults()
};