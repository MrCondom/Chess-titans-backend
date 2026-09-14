const prisma = require("../lib/prisma");

function validateId(value, name = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${name}.`);
    error.code = "INVALID_ID";
    throw error;
  }

  return id;
}

function validateScore(value, name) {
  const score = Number(value);

  if (!Number.isFinite(score) || score < 0) {
    const error = new Error(`Invalid ${name} score.`);
    error.code = "INVALID_SCORE";
    throw error;
  }

  return score;
}

function validateChessScore(whiteScore, blackScore) {
  const total = whiteScore + blackScore;

  if (total <= 0) {
    const error = new Error(
      "Invalid chess result. At least one player must have a score greater than zero."
    );

    error.code = "INVALID_RESULT_SCORE";

    throw error;
  }

  const isHalfPoint = (score) =>
    Number.isInteger(score * 2);

  if (
    !isHalfPoint(whiteScore) ||
    !isHalfPoint(blackScore)
  ) {
    const error = new Error(
      "Invalid chess result. Scores must use whole or half-point values."
    );

    error.code = "INVALID_RESULT_SCORE";

    throw error;
  }
}

function validateTeamResult(value) {
  const result = Number(value);

  if (!Number.isFinite(result)) {
    const error = new Error(
      "Invalid team game result."
    );

    error.code = "INVALID_TEAM_RESULT";

    throw error;
  }

  const validResults = [
    0,
    0.5,
    1,
    1.5,
    2,
  ];

  if (!validResults.includes(result)) {
    const error = new Error(
      "Invalid team game result. Scores must be 0, 0.5, 1, 1.5, or 2."
    );

    error.code = "INVALID_TEAM_RESULT";

    throw error;
  }

  return result;
}

async function createResult({
  pairingId,
  whiteScore,
  blackScore,
}) {
  const pairingIdNumber = validateId(
    pairingId,
    "pairing ID"
  );

  const white = validateScore(
    whiteScore,
    "white"
  );

  const black = validateScore(
    blackScore,
    "black"
  );

  validateChessScore(white, black);

  return prisma.$transaction(async (tx) => {
    const pairing = await tx.pairing.findUnique({
      where: {
        id: pairingIdNumber,
      },
    });

    if (!pairing) {
      const error = new Error(
        "Pairing not found. A result can only be recorded for an existing pairing."
      );

      error.code = "PAIRING_NOT_FOUND";

      throw error;
    }

    if (
      !pairing.whitePlayerId ||
      !pairing.blackPlayerId
    ) {
      const error = new Error(
        "This pairing does not have two players."
      );

      error.code = "INVALID_PAIRING";

      throw error;
    }

    const existingResult =
      await tx.gameResult.findUnique({
        where: {
          pairingId: pairingIdNumber,
        },
      });

    if (existingResult) {
      const error = new Error(
        "A result has already been submitted for this pairing."
      );

      error.code = "RESULT_ALREADY_EXISTS";

      throw error;
    }

    const result =
      await tx.gameResult.create({
        data: {
          round: pairing.round,
          mode: pairing.mode,

          whitePlayerId:
            pairing.whitePlayerId,

          blackPlayerId:
            pairing.blackPlayerId,

          whiteScore: white,
          blackScore: black,

          category: pairing.category,

          pairingId: pairing.id,

          approvalStatus: "PENDING",

          approvedAt: null,
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
  isAdmin = false,
}) {
  const resultIdNumber = validateId(
    resultId,
    "result ID"
  );

  const white = validateScore(
    whiteScore,
    "white"
  );

  const black = validateScore(
    blackScore,
    "black"
  );

  validateChessScore(white, black);

  const result =
    await prisma.gameResult.findUnique({
      where: {
        id: resultIdNumber,
      },
    });

  if (!result) {
    const error = new Error(
      "Result not found."
    );

    error.code = "RESULT_NOT_FOUND";

    throw error;
  }

  if (
    result.approvalStatus === "APPROVED" &&
    !isAdmin
  ) {
    const error = new Error(
      "This result has already been approved. Only an administrator can edit an approved result."
    );

    error.code =
      "RESULT_APPROVED_ADMIN_ONLY";

    throw error;
  }

  const appliedGain =
    await prisma.ratingGain.findFirst({
      where: {
        pairingId: result.pairingId,

        playerId: {
          in: [
            result.whitePlayerId,
            result.blackPlayerId,
          ],
        },

        isApplied: true,
      },
    });

  if (appliedGain) {
    const error = new Error(
      "Cannot edit this result because its rating gain has already been applied."
    );

    error.code =
      "RESULT_RATING_ALREADY_APPLIED";

    throw error;
  }

  const updateData = {
    whiteScore: white,
    blackScore: black,
  };

  // A rejected result is being resubmitted.
  // It must return to PENDING for admin approval.
  if (
    result.approvalStatus === "REJECTED"
  ) {
    updateData.approvalStatus = "PENDING";
    updateData.approvedAt = null;
    updateData.rejectionReason = null;
    updateData.whiteRatingChange = null;
    updateData.blackRatingChange = null;
  }

  const updatedResult =
    await prisma.gameResult.update({
      where: {
        id: resultIdNumber,
      },

      data: updateData,

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

  // Approved results edited by an admin remain approved
  // and their rating gains are recalculated.
  if (
    result.approvalStatus === "APPROVED"
  ) {
    const ratingService =
      require("./ratingService");

    return ratingService
      .recalculateEditedResultGains(
        resultIdNumber
      );
  }

  return updatedResult;
}

/**
 * Delete a result.
 */
async function deleteResult({
  resultId,
  isAdmin = false,
}) {
  const resultIdNumber = validateId(
    resultId,
    "result ID"
  );

  const result =
    await prisma.gameResult.findUnique({
      where: {
        id: resultIdNumber,
      },
    });

  if (!result) {
    const error = new Error(
      "Result not found."
    );

    error.code = "RESULT_NOT_FOUND";

    throw error;
  }

  if (
    result.approvalStatus === "APPROVED" &&
    !isAdmin
  ) {
    const error = new Error(
      "Approved results can only be deleted by an administrator."
    );

    error.code =
      "RESULT_APPROVED_ADMIN_ONLY";

    throw error;
  }

  const appliedGain =
    await prisma.ratingGain.findFirst({
      where: {
        pairingId: result.pairingId,

        playerId: {
          in: [
            result.whitePlayerId,
            result.blackPlayerId,
          ],
        },

        isApplied: true,
      },
    });

  if (appliedGain) {
    const error = new Error(
      "Cannot delete this result because its rating gain has already been applied."
    );

    error.code =
      "RESULT_RATING_ALREADY_APPLIED";

    throw error;
  }

  await prisma.gameResult.delete({
    where: {
      id: resultIdNumber,
    },
  });

  return {
    success: true,
    message: "Result deleted successfully.",
  };
}

async function deleteAllResults() {
  return prisma.$transaction(async (tx) => {
    // ======================================================
    // COLLECT ALL PAIRING / TEAM GAME IDS
    // ======================================================

    const pairings = await tx.pairing.findMany({
      select: {
        id: true,
      },
    });

    const teamGames = await tx.teamGame.findMany({
      select: {
        id: true,
      },
    });

    const pairingIds = pairings.map(
      (pairing) => pairing.id
    );

    const teamGameIds = teamGames.map(
      (game) => game.id
    );

    // ======================================================
    // DELETE APPROVED NORMAL / SPECIAL RESULTS
    // ======================================================

    const deletedApprovedResults =
      await tx.gameResult.deleteMany({
        where: {
          approvalStatus: "APPROVED",
        },
      });

    // ======================================================
    // DELETE RATING GAINS CONNECTED TO THE
    // PAIRINGS / TEAM GAMES BEING REMOVED
    // ======================================================

    let deletedRatingGains = 0;

    if (
      pairingIds.length > 0 ||
      teamGameIds.length > 0
    ) {
      const ratingGainWhere = [];

      if (pairingIds.length > 0) {
        ratingGainWhere.push({
          pairingId: {
            in: pairingIds,
          },
        });
      }

      if (teamGameIds.length > 0) {
        ratingGainWhere.push({
          teamGameId: {
            in: teamGameIds,
          },
        });
      }

      const deletedGains =
        await tx.ratingGain.deleteMany({
          where: {
            OR: ratingGainWhere,
          },
        });

      deletedRatingGains =
        deletedGains.count;
    }

    // ======================================================
    // DELETE ALL TEAM PAIRINGS
    //
    // This also cascades and deletes all TeamGames.
    // ======================================================

    const deletedTeamPairings =
      await tx.teamPairing.deleteMany({});

    // ======================================================
    // DELETE ALL NORMAL + CATEGORY + SPECIAL PAIRINGS
    //
    // This includes special/event pairings because they
    // are stored in the same Pairing table.
    // ======================================================

    const deletedPairings =
      await tx.pairing.deleteMany({});

    return {
      deletedApprovedResults:
        deletedApprovedResults.count,

      deletedPairings:
        deletedPairings.count,

      deletedTeamPairings:
        deletedTeamPairings.count,

      deletedTeamGames:
        teamGames.length,

      deletedRatingGains,
    };
  });
}

// ============================================================
// GET ALL PAIRINGS/GAMES FOR RESULT RECORDING
// ============================================================

async function getResultPairings() {
  const [
    normalPairings,
    teamGames,
  ] = await Promise.all([
    prisma.pairing.findMany({
      orderBy: [
        {
          round: "asc",
        },
        {
          availableAt: "asc",
        },
        {
          id: "asc",
        },
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

        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            format: true,
            status: true,
          },
        },
      },
    }),

    // ========================================================
    // TEAM BOARD GAMES
    // ========================================================

    prisma.teamGame.findMany({
      orderBy: [
        {
          teamPairing: {
            round: "asc",
          },
        },
        {
          boardPosition: "asc",
        },
        {
          id: "asc",
        },
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
      },
    }),
  ]);

  // ==========================================================
  // NORMAL + SPECIAL
  // ==========================================================

  const normal = normalPairings.map(
    (pairing) => ({
      id: pairing.id,

      pairingType:
        pairing.tournamentId
          ? "SPECIAL"
          : "NORMAL",

      round: pairing.round,

      mode: pairing.mode,

      category:
        pairing.category || null,

      tournamentId:
        pairing.tournamentId || null,

      eventName:
        pairing.tournament?.name || null,

      eventType:
        pairing.tournament?.type || null,

      teamCategory: null,

      whitePlayerId:
        pairing.whitePlayerId,

      blackPlayerId:
        pairing.blackPlayerId,

      whitePlayer:
        pairing.whitePlayer,

      blackPlayer:
        pairing.blackPlayer,

      availableAt:
        pairing.availableAt,

      createdAt:
        pairing.createdAt,

      result:
        pairing.result || null,

      teamPairingId: null,

      boardPosition: null,

      teamAId: null,

      teamBId: null,

      teamAName: null,

      teamBName: null,
    })
  );

  const teams = teamGames.map(
    (game) => {
      const teamPairing =
        game.teamPairing;

      return {
        id: game.id,

        pairingType: "TEAM",

        round:
          teamPairing.round,

        mode:
          teamPairing.mode,

        category: null,

        tournamentId: null,

        eventName: null,

        teamCategory:
          `${teamPairing.teamA.name} vs ${teamPairing.teamB.name}`,

        whitePlayerId:
          game.whitePlayerId,

        blackPlayerId:
          game.blackPlayerId,

        whitePlayer:
          game.whitePlayer,

        blackPlayer:
          game.blackPlayer,

        availableAt:
          teamPairing.availableAt,

        createdAt:
          game.createdAt,

        // TeamGame stores its result directly
        // on the TeamGame row.
        teamResult:
          game.result === null
            ? null
            : {
                id: game.id,
                result: game.result,
                approvalStatus:
                  game.approvalStatus,
              },

        // TEAM games do not use GameResult.
        result: null,

        teamPairingId:
          game.teamPairingId,

        boardPosition:
          game.boardPosition,

        teamAId:
          teamPairing.teamAId,

        teamBId:
          teamPairing.teamBId,

        teamAName:
          teamPairing.teamA.name,

        teamBName:
          teamPairing.teamB.name,
      };
    }
  );

  return [
    ...normal,
    ...teams,
  ].sort((a, b) => {
    if (a.round !== b.round) {
      return a.round - b.round;
    }

    const aTime =
      a.availableAt
        ? new Date(
            a.availableAt
          ).getTime()
        : 0;

    const bTime =
      b.availableAt
        ? new Date(
            b.availableAt
          ).getTime()
        : 0;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return a.id - b.id;
  });
}

// ============================================================
// TEAM GAME RESULTS
// ============================================================

async function createTeamGameResult({
  teamGameId,
  result,
}) {
  const teamGameIdNumber =
    validateId(
      teamGameId,
      "team game ID"
    );

  const validatedResult =
    validateTeamResult(result);

  return prisma.$transaction(
    async (tx) => {
      const teamGame =
        await tx.teamGame.findUnique({
          where: {
            id: teamGameIdNumber,
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
        teamGame.whitePlayerId == null ||
        teamGame.blackPlayerId == null
      ) {
        const error = new Error(
          "This team game does not have two players."
        );

        error.code =
          "INVALID_TEAM_GAME";

        throw error;
      }

      if (teamGame.result !== null) {
        const error = new Error(
          "A result has already been submitted for this team game."
        );

        error.code =
          "TEAM_RESULT_ALREADY_EXISTS";

        throw error;
      }

      const updatedTeamGame =
        await tx.teamGame.update({
          where: {
            id: teamGameIdNumber,
          },

          data: {
            result: validatedResult,
            approvalStatus: "PENDING",
            approvedAt: null,
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
          },
        });

      return updatedTeamGame;
    }
  );
}

async function updateTeamGameResult({
  resultId,
  result,
  isAdmin = false,
}) {
  const resultIdNumber =
    validateId(
      resultId,
      "team game ID"
    );

  const validatedResult =
    validateTeamResult(result);

  /*
   * We need to remember the original approval status
   * because an APPROVED result must remain APPROVED
   * and have its rating gains recalculated.
   */
  let wasApproved = false;

  const updatedTeamGame =
    await prisma.$transaction(
      async (tx) => {
        const teamGame =
          await tx.teamGame.findUnique({
            where: {
              id: resultIdNumber,
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
          teamGame.approvalStatus ===
            "APPROVED" &&
          !isAdmin
        ) {
          const error = new Error(
            "This team game result has already been approved. Only an administrator can edit it."
          );

          error.code =
            "TEAM_RESULT_APPROVED_ADMIN_ONLY";

          throw error;
        }

        /*
         * Remember whether this was an approved result
         * BEFORE changing it.
         */
        wasApproved =
          teamGame.approvalStatus ===
          "APPROVED";

        const updateData = {
          result: validatedResult,
        };

        /*
         * Rejected results are being resubmitted.
         * They must return to PENDING.
         */
        if (
          teamGame.approvalStatus ===
          "REJECTED"
        ) {
          updateData.approvalStatus =
            "PENDING";

          updateData.approvedAt = null;

          updateData.rejectionReason =
            null;
        }

        /*
         * IMPORTANT:
         *
         * If the result was APPROVED, we do NOT
         * change approvalStatus here.
         *
         * It remains APPROVED until the rating
         * recalculation is completed.
         */
        const updated =
          await tx.teamGame.update({
            where: {
              id: resultIdNumber,
            },

            data: updateData,

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
            },
          });

        return updated;
      }
    );

  /*
   * Approved team results require rating-gain
   * recalculation after the score changes.
   *
   * This happens OUTSIDE the transaction because
   * recalculateEditedResultGains() manages its own
   * database operations.
   */
  if (wasApproved) {
    const ratingService =
      require("./ratingService");

    return ratingService.recalculateEditedResultGains(
      resultIdNumber,
      "TEAM"
    );
  }

  return updatedTeamGame;
}

module.exports = {
  createResult,
  updateResult,
  deleteResult,
  deleteAllResults,
  getResultPairings,
  createTeamGameResult,
  updateTeamGameResult,
};