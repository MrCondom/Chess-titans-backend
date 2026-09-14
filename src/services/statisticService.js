const prisma = require("../lib/prisma");

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}


function applyStandardScoreStatistics(stats, score) {
  const numericScore = Number(score);

  switch (numericScore) {
    case 2:
      stats.totalWins += 2;
      break;

    case 1.5:
      stats.totalWins += 1;
      stats.totalDraws += 1;
      break;

    case 1:
      stats.totalDraws += 2;
      break;

    case 0.5:
      stats.totalDraws += 1;
      stats.totalLosses += 1;
      break;

    case 0:
      stats.totalLosses += 2;
      break;

    default:
      throw createError(
        `Invalid standard result score: ${score}`
      );
  }

  stats.totalRounds += 2;
}


function applySpecialScoreStatistics(stats, score) {
  const numericScore = Number(score);

  switch (numericScore) {
    case 1:
      stats.totalWins += 1;
      break;

    case 0.5:
      stats.totalDraws += 1;
      break;

    case 0:
      stats.totalLosses += 1;
      break;

    default:
      throw createError(
        `Invalid special result score: ${score}`
      );
  }

  stats.totalRounds += 1;
}


async function applyPlayerStatistics() {
  return prisma.$transaction(async (tx) => {
    const playerStats = new Map();

    function ensurePlayer(playerId) {
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
          totalPoints: 0,
          totalRounds: 0,
          totalWins: 0,
          totalDraws: 0,
          totalLosses: 0,
        });
      }

      return playerStats.get(playerId);
    }

    const gameResults = await tx.gameResult.findMany({
      where: {
        approvalStatus: "APPROVED",
        playerStatisticsApplied: false,
      },
      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
        whiteScore: true,
        blackScore: true,
        pairing: {
          select: {
            tournamentId: true,
          },
        },
      },
    });

    const teamGames = await tx.teamGame.findMany({
      where: {
        approvalStatus: "APPROVED",
        playerStatisticsApplied: false,
      },
      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
        result: true,
      },
    });

    for (const result of gameResults) {
      const white = ensurePlayer(result.whitePlayerId);
      const black = ensurePlayer(result.blackPlayerId);

      const whiteScore = Number(result.whiteScore);
      const blackScore = Number(result.blackScore);

      white.totalPoints += whiteScore;
      black.totalPoints += blackScore;

      const isSpecial = Boolean(result.pairing?.tournamentId);

      if (isSpecial) {
        applySpecialScoreStatistics(white, whiteScore);
        applySpecialScoreStatistics(black, blackScore);
      } else {
        applyStandardScoreStatistics(white, whiteScore);
        applyStandardScoreStatistics(black, blackScore);
      }
    }

    for (const game of teamGames) {
      const white = ensurePlayer(game.whitePlayerId);
      const black = ensurePlayer(game.blackPlayerId);

      const whiteScore = Number(game.result);
      const blackScore = 2 - whiteScore;

      white.totalPoints += whiteScore;
      black.totalPoints += blackScore;

      applyStandardScoreStatistics(white, whiteScore);
      applyStandardScoreStatistics(black, blackScore);
    }

    /*
     * Add the newly calculated statistics to the existing
     * lifetime player statistics.
     */
    for (const [playerId, stats] of playerStats.entries()) {
      await tx.player.update({
        where: { id: playerId },
        data: {
          totalPoints: {
            increment: stats.totalPoints,
          },
          totalRounds: {
            increment: stats.totalRounds,
          },
          totalWins: {
            increment: stats.totalWins,
          },
          totalDraws: {
            increment: stats.totalDraws,
          },
          totalLosses: {
            increment: stats.totalLosses,
          },
        },
      });
    }

    /*
     * Mark these exact results as processed.
     * Because this happens inside the same transaction,
     * the statistics and flags stay synchronized.
     */
    if (gameResults.length > 0) {
      await tx.gameResult.updateMany({
        where: {
          id: {
            in: gameResults.map((result) => result.id),
          },
        },
        data: {
          playerStatisticsApplied: true,
        },
      });
    }

    if (teamGames.length > 0) {
      await tx.teamGame.updateMany({
        where: {
          id: {
            in: teamGames.map((game) => game.id),
          },
        },
        data: {
          playerStatisticsApplied: true,
        },
      });
    }

    return {
      success: true,
      message:
        gameResults.length === 0 && teamGames.length === 0
          ? "No new approved results are waiting to be applied."
          : "Player statistics applied successfully.",
      playersUpdated: playerStats.size,
      gameResultsProcessed: gameResults.length,
      teamGamesProcessed: teamGames.length,
    };
  });
}


async function applyTeamStatistics() {
  return prisma.$transaction(async (tx) => {
    const teamStats = new Map();

    function ensureTeam(teamId) {
      if (!teamStats.has(teamId)) {
        teamStats.set(teamId, {
          totalPoints: 0,
        });
      }

      return teamStats.get(teamId);
    }

    const teamGames = await tx.teamGame.findMany({
      where: {
        approvalStatus: "APPROVED",
        teamStatisticsApplied: false,
      },
      select: {
        id: true,
        result: true,
        teamPairing: {
          select: {
            teamAId: true,
            teamBId: true,
          },
        },
      },
    });

    for (const game of teamGames) {
      const teamAId = game.teamPairing?.teamAId;
      const teamBId = game.teamPairing?.teamBId;

      if (!teamAId || !teamBId) {
        continue;
      }

      const teamAScore = Number(game.result);
      const teamBScore = 2 - teamAScore;

      const teamA = ensureTeam(teamAId);
      const teamB = ensureTeam(teamBId);

      teamA.totalPoints += teamAScore;
      teamB.totalPoints += teamBScore;
    }

    /*
     * Add points to the existing lifetime team totals.
     */
    for (const [teamId, stats] of teamStats.entries()) {
      await tx.team.update({
        where: {
          id: teamId,
        },
        data: {
          totalPoints: {
            increment: stats.totalPoints,
          },
        },
      });
    }

    /*
     * Mark every processed TeamGame so it cannot
     * be counted again.
     */
    if (teamGames.length > 0) {
      await tx.teamGame.updateMany({
        where: {
          id: {
            in: teamGames.map((game) => game.id),
          },
        },
        data: {
          teamStatisticsApplied: true,
        },
      });
    }

    return {
      success: true,
      message:
        teamGames.length === 0
          ? "No new approved team games are waiting to be applied."
          : "Team statistics applied successfully.",
      teamsUpdated: teamStats.size,
      teamGamesProcessed: teamGames.length,
    };
  });
}

module.exports = {
  applyPlayerStatistics,
  applyTeamStatistics,
};

