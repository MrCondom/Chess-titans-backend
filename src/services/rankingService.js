const prisma = require("../lib/prisma");

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
    });
  }

  rankingData.sort((a, b) => {

    if (b.rating !== a.rating) {
      return b.rating - a.rating;
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
        rating: item.rating,

        tournamentId: null,
        month: null,
        year: null,
      })),
    });
  });


  return rankingData.map((item) => ({
    playerId: item.player.id,

    fullName: item.player.fullName,
    username: item.player.username,

    category,
    mode,

    rank: item.rank,

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

async function getOverallPlayerRankings() {
  const players = await prisma.player.findMany({
    where: {
      status: "ACTIVE",
    },

    select: {
      id: true,
      fullName: true,
      username: true,
      category: true,
      totalPoints: true,
    },

    orderBy: {
      totalPoints: "desc",
    },
  });

  let currentRank = 0;
  let previousPoints = null;

  return players.map((player, index) => {
    if (player.totalPoints !== previousPoints) {
      currentRank = index + 1;
    }

    previousPoints = player.totalPoints;

    return {
      playerId: player.id,
      fullName: player.fullName,
      username: player.username,
      category: player.category,
      totalPoints: player.totalPoints,
      rank: currentRank,
    };
  });
}

async function getTeamRankings() {
  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      totalPoints: true,
    },

    orderBy: {
      totalPoints: "desc",
    },
  });

  let currentRank = 0;
  let previousPoints = null;

  return teams.map((team, index) => {
    if (team.totalPoints !== previousPoints) {
      currentRank = index + 1;
    }

    previousPoints = team.totalPoints;

    return {
      teamId: team.id,
      name: team.name,
      description: team.description,
      totalPoints: team.totalPoints,
      rank: currentRank,
    };
  });
}



module.exports = {
  calculateRankings,
  getRankings,
  getPlayerRanking,
  getOverallPlayerRankings,
  getTeamRankings
};

