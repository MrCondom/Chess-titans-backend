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



async function calculateRankings({
  category,
  mode,
}) {
  validateMode(mode);

  if (!category || typeof category !== "string") {
    throw new Error("Category is required.");
  }

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



module.exports = {
  calculateRankings,
  getRankings,
  getPlayerRanking,
};

