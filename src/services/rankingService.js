const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];

function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }
}


function getResult(scoreFor, scoreAgainst) {
  if (scoreFor > scoreAgainst) {
    return "WIN";
  }

  if (scoreFor < scoreAgainst) {
    return "LOSS";
  }

  return "DRAW";
}


/**
 * Convert result into ranking points.
 */
function getPoints(result) {
  if (result === "WIN") {
    return 1;
  }

  if (result === "DRAW") {
    return 0.5;
  }

  return 0;
}


/**
 * Calculate a player's statistics from approved results.
 */
async function calculatePlayerStats({
  playerId,
  mode,
  category,
}) {
  validateMode(mode);

  const results = await prisma.gameResult.findMany({
    where: {
      mode,
      category,
      approvalStatus: "APPROVED",

      OR: [
        {
          whitePlayerId: playerId,
        },
        {
          blackPlayerId: playerId,
        },
      ],
    },

    select: {
      id: true,

      whitePlayerId: true,
      blackPlayerId: true,

      whiteScore: true,
      blackScore: true,
    },
  });

  let totalPoints = 0;
  let totalRounds = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  let scoreFor = 0;
  let scoreAgainst = 0;

  for (const result of results) {
    const isWhite =
      result.whitePlayerId === playerId;

    const playerScore = isWhite
      ? result.whiteScore
      : result.blackScore;

    const opponentScore = isWhite
      ? result.blackScore
      : result.whiteScore;

    const gameResult = getResult(
      playerScore,
      opponentScore
    );

    totalPoints += getPoints(gameResult);

    totalRounds++;

    scoreFor += playerScore;
    scoreAgainst += opponentScore;

    if (gameResult === "WIN") {
      wins++;
    }

    else if (gameResult === "DRAW") {
      draws++;
    }

    else {
      losses++;
    }
  }

  /**
   * Accuracy represents percentage of available
   * ranking points earned.
   *
   * Example:
   *
   * 5 wins + 2 draws
   *
   * points = 6
   * rounds = 7
   *
   * accuracy = 85.71%
   */
  const accuracy =
    totalRounds > 0
      ? Number(
          (
            (totalPoints / totalRounds) *
            100
          ).toFixed(2)
        )
      : 0;

  return {
    totalPoints,
    totalRounds,
    accuracy,

    wins,
    draws,
    losses,

    scoreFor,
    scoreAgainst,
  };
}


/**
 * Calculate and save rankings for one
 * category + mode.
 *
 * This creates a current ranking snapshot.
 */
async function calculateRankings({
  category,
  mode,
}) {
  validateMode(mode);

  if (!category || typeof category !== "string") {
    throw new Error("Category is required.");
  }

  /**
   * Get all active players in this category.
   */
  const players = await prisma.player.findMany({
    where: {
      category,
      status: "ACTIVE",
    },

    select: {
      id: true,
      fullName: true,
      username: true,

      rapidRating: true,
      blitzRating: true,
      bulletRating: true,
    },
  });

  const rankingData = [];

  for (const player of players) {
    const stats =
      await calculatePlayerStats({
        playerId: player.id,
        mode,
        category,
      });

    /**
     * Rating is used as a secondary
     * tiebreaker.
     */
    let rating = 0;

    if (mode === "RAPID") {
      rating = player.rapidRating;
    }

    else if (mode === "BLITZ") {
      rating = player.blitzRating;
    }

    else if (mode === "BULLET") {
      rating = player.bulletRating;
    }

    rankingData.push({
      player,
      rating,
      ...stats,
    });
  }

  /**
   * Ranking order:
   *
   * 1. Total points
   * 2. Accuracy
   * 3. Rating
   * 4. Total rounds
   * 5. Username
   */
  rankingData.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }

    if (b.accuracy !== a.accuracy) {
      return b.accuracy - a.accuracy;
    }

    if (b.rating !== a.rating) {
      return b.rating - a.rating;
    }

    if (b.totalRounds !== a.totalRounds) {
      return b.totalRounds - a.totalRounds;
    }

    return a.player.username.localeCompare(
      b.player.username
    );
  });

  /**
   * Assign ranks.
   *
   * Competition ranking:
   *
   * 1
   * 2
   * 2
   * 4
   */
  let previous = null;
  let currentRank = 0;

  for (let i = 0; i < rankingData.length; i++) {
    const item = rankingData[i];

    const sameAsPrevious =
      previous &&
      previous.totalPoints === item.totalPoints &&
      previous.accuracy === item.accuracy &&
      previous.rating === item.rating;

    if (!sameAsPrevious) {
      currentRank = i + 1;
    }

    item.rank = currentRank;

    previous = item;
  }

  /**
   * Current ranking snapshot.
   *
   * We remove the old current snapshot
   * for this category/mode and rebuild it.
   *
   * tournamentId = null
   * month/year = null
   */
  await prisma.$transaction(async (tx) => {
    await tx.playerRanking.deleteMany({
      where: {
        category,
        mode,
        tournamentId: null,
        month: null,
        year: null,
      },
    });

    if (rankingData.length === 0) {
      return;
    }

    await tx.playerRanking.createMany({
      data: rankingData.map((item) => ({
        playerId: item.player.id,

        category,
        mode,

        rank: item.rank,

        totalPoints: item.totalPoints,
        totalRounds: item.totalRounds,

        accuracy: item.accuracy,

        tournamentId: null,
        month: null,
        year: null,
      })),
    });
  });

  /**
   * Notify players whose ranking changed.
   *
   * Notification failure must never break
   * the ranking calculation.
   */
  try {
    await Promise.all(
      rankingData.map((item) =>
        notificationService.createNotification({
          playerId: item.player.id,
          type: "RANKING",
          title: "Ranking Updated",
          message:
            `Your ${mode} ranking for ${category} ` +
            `is now #${item.rank}.`,
        })
      )
    );
  } catch (error) {
    console.error(
      "RANKING NOTIFICATION ERROR:",
      error
    );
  }

  return rankingData.map((item) => ({
    playerId: item.player.id,

    fullName: item.player.fullName,
    username: item.player.username,

    category,
    mode,

    rank: item.rank,

    totalPoints: item.totalPoints,
    totalRounds: item.totalRounds,

    accuracy: item.accuracy,

    wins: item.wins,
    draws: item.draws,
    losses: item.losses,

    rating: item.rating,
  }));
}


/**
 * Get current rankings.
 */
async function getRankings({
  category,
  mode,
}) {
  validateMode(mode);

  if (!category) {
    throw new Error("Category is required.");
  }

  return prisma.playerRanking.findMany({
    where: {
      category,
      mode,

      tournamentId: null,
      month: null,
      year: null,
    },

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

    orderBy: [
      {
        rank: "asc",
      },

      {
        playerId: "asc",
      },
    ],
  });
}


/**
 * Get one player's current ranking.
 */
async function getPlayerRanking({
  playerId,
  category,
  mode,
}) {
  playerId = Number(playerId);

  if (
    !Number.isInteger(playerId) ||
    playerId <= 0
  ) {
    throw new Error("Invalid player ID.");
  }

  validateMode(mode);

  if (!category) {
    throw new Error("Category is required.");
  }

  return prisma.playerRanking.findFirst({
    where: {
      playerId,
      category,
      mode,

      tournamentId: null,
      month: null,
      year: null,
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


/**
 * Recalculate rankings affected by a result.
 */
async function recalculateAfterResult(resultId) {
  resultId = Number(resultId);

  if (
    !Number.isInteger(resultId) ||
    resultId <= 0
  ) {
    throw new Error("Invalid result ID.");
  }

  const result = await prisma.gameResult.findUnique({
    where: {
      id: resultId,
    },

    select: {
      category: true,
      mode: true,
      approvalStatus: true,
    },
  });

  if (!result) {
    throw new Error("Result not found.");
  }

  if (result.approvalStatus !== "APPROVED") {
    return null;
  }

  return calculateRankings({
    category: result.category,
    mode: result.mode,
  });
}


module.exports = {
  getResult,
  getPoints,
  calculatePlayerStats,
  calculateRankings,
  getRankings,
  getPlayerRanking,
  recalculateAfterResult,
};

