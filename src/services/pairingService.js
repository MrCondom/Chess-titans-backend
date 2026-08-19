const prisma = require("../lib/prisma");

const notificationService = require("./notificationService")


function validateMode(mode) {
  const validModes = ["RAPID", "BLITZ", "BULLET"];

  if (!validModes.includes(mode)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }
}


async function getEligiblePlayers(category) {
  return prisma.player.findMany({
    where: {
      status: "ACTIVE",
      category: category,
    },

    select: {
      id: true,
      fullName: true,
      username: true,
      category: true,
    },

    orderBy: {
      id: "asc",
    },
  });
}


async function hasExistingPairing(
  category,
  round,
  mode,
  playerAId,
  playerBId
) {
  const existing = await prisma.pairing.findFirst({
    where: {
      category,
      round,
      mode,

      OR: [
        {
          whitePlayerId: playerAId,
          blackPlayerId: playerBId,
        },
        {
          whitePlayerId: playerBId,
          blackPlayerId: playerAId,
        },
      ],
    },
  });

  return !!existing;
}

async function hasPlayedBefore(
  category,
  mode,
  playerAId,
  playerBId
) {
  const existing = await prisma.pairing.findFirst({
    where: {
      category,
      mode,

      OR: [
        {
          whitePlayerId: playerAId,
          blackPlayerId: playerBId,
        },
        {
          whitePlayerId: playerBId,
          blackPlayerId: playerAId,
        },
      ],
    },
  });

  return !!existing;
}


function shufflePlayers(players) {
  const shuffled = [...players];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}


async function generatePairings({
  category,
  round,
  mode,
  availableAt,
}) {
  if (!category || typeof category !== "string") {
    throw new Error("Category is required.");
  }

  category = category.trim();

  if (!category) {
    throw new Error("Category cannot be empty.");
  }

  if (!Number.isInteger(round) || round <= 0) {
    throw new Error("Round must be a positive integer.");
  }

  validateMode(mode);

  const players = await getEligiblePlayers(category);

  if (players.length < 2) {
    throw new Error(
      "At least two active players are required to generate pairings."
    );
  }

  const shuffledPlayers = shufflePlayers(players);

  const pairingsToCreate = [];

  for (let i = 0; i < shuffledPlayers.length - 1; i += 2) {
    const playerA = shuffledPlayers[i];
    const playerB = shuffledPlayers[i + 1];

    const alreadyExists = await hasExistingPairing(
      category,
      round,
      mode,
      playerA.id,
      playerB.id
    );

    if (alreadyExists) {
      continue;
    }

    pairingsToCreate.push({
      category,
      round,
      mode,

      whitePlayerId: playerA.id,
      blackPlayerId: playerB.id,

      availableAt:
        availableAt instanceof Date
          ? availableAt
          : new Date(),
    });
  }

  if (pairingsToCreate.length === 0) {
    throw new Error(
      "No new pairings could be generated. These players may already have pairings for this round."
    );
  }

  const createdPairings = [];

  for (const pairing of pairingsToCreate) {
    try {
      const created = await prisma.pairing.create({
        data: pairing,

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
        },
      });

      createdPairings.push(created);

      await notificationService.notifyPairingCreated(created)
    } catch (error) {
      
      if (error.code === "P2002") {
        continue;
      }

      throw error;
    }
  }

  return {
    category,
    round,
    mode,
    count: createdPairings.length,
    pairings: createdPairings,
  };
}


async function getPlayerPairings(
  playerId,
  options = {}
) {
  if (!Number.isInteger(playerId) || playerId <= 0) {
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
    if (
      !Number.isInteger(options.round) ||
      options.round <= 0
    ) {
      throw new Error("Invalid round.");
    }

    where.round = options.round;
  }

  if (options.category) {
    where.category = options.category;
  }

  return prisma.pairing.findMany({
    where,

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

    orderBy: [
      {
        round: "desc",
      },
      {
        availableAt: "desc",
      },
    ],
  });
}


async function getPairingById(pairingId) {
  if (!Number.isInteger(pairingId) || pairingId <= 0) {
    throw new Error("Invalid pairing ID.");
  }

  return prisma.pairing.findUnique({
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
}


async function getAllPairings(filters = {}) {
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
    if (
      !Number.isInteger(filters.round) ||
      filters.round <= 0
    ) {
      throw new Error("Invalid round.");
    }

    where.round = filters.round;
  }

  return prisma.pairing.findMany({
    where,

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

    orderBy: [
      {
        round: "desc",
      },
      {
        availableAt: "asc",
      },
    ],
  });
}


module.exports = {
  generatePairings,
  getPlayerPairings,
  getPairingById,
  getAllPairings,
};