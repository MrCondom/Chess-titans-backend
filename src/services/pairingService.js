const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];

function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    const error = new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );

    error.code = "INVALID_GAME_MODE";
    throw error;
  }

  return mode;
}

function validateId(value, field = "ID") {
  const result = Number(value);

  if (!Number.isInteger(result) || result <= 0) {
    const error = new Error(`Invalid ${field}.`);
    error.code = "INVALID_ID";
    throw error;
  }

  return result;
}

function validateRound(round) {
  if (!Number.isInteger(round) || round <= 0) {
    const error = new Error(
      "Round must be a positive integer."
    );

    error.code = "INVALID_ROUND";
    throw error;
  }

  return round;
}



const playerSelect = {
  id: true,
  fullName: true,
  username: true,
  category: true,
};


async function getTournamentPlayers(tournamentId) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      select: {
        id: true,
        status: true,
        mode: true,
        category: true,
        type: true,
        format: true,

        players: {
          include: {
            player: {
              select: playerSelect,
            },
          },

          orderBy: {
            playerId: "asc",
          },
        },
      },
    });

  if (!tournament) {
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";
    throw error;
  }

  return tournament;
}


async function hasExistingPairing(
  tournamentId,
  round,
  mode,
  playerAId,
  playerBId
) {
  return prisma.pairing.findFirst({
    where: {
      tournamentId,
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
}

async function hasPlayedBefore(
  tournamentId,
  mode,
  playerAId,
  playerBId
) {
  return prisma.pairing.findFirst({
    where: {
      tournamentId,
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
}


function shufflePlayers(players) {
  const shuffled = [...players];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}


async function generateTournamentPairings({
  tournamentId,
  round,
  availableAt,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round = validateRound(round);

  const tournament =
    await getTournamentPlayers(
      tournamentId
    );

  if (tournament.status !== "ACTIVE") {
    const error = new Error(
      "Pairings can only be generated for an ACTIVE tournament."
    );

    error.code = "INVALID_TOURNAMENT_STATUS";
    throw error;
  }

  validateMode(tournament.mode);

  if (
    !["SWISS", "ROUND_ROBIN"].includes(
      tournament.format
    )
  ) {
    const error = new Error(
      "This tournament format does not use player pairings."
    );

    error.code = "INVALID_TOURNAMENT_FORMAT";
    throw error;
  }

  const players =
    tournament.players.map(
      (entry) => entry.player
    );

  if (players.length < 2) {
    const error = new Error(
      "At least two players are required."
    );

    error.code = "INSUFFICIENT_PLAYERS";
    throw error;
  }

  const shuffledPlayers =
    shufflePlayers(players);

  const pairingsToCreate = [];

  
  for (
    let i = 0;
    i < shuffledPlayers.length - 1;
    i += 2
  ) {
    const playerA =
      shuffledPlayers[i];

    const playerB =
      shuffledPlayers[i + 1];

    const alreadyPlayed =
      await hasPlayedBefore(
        tournamentId,
        tournament.mode,
        playerA.id,
        playerB.id
      );

    if (alreadyPlayed) {
      continue;
    }

    const exists =
      await hasExistingPairing(
        tournamentId,
        round,
        tournament.mode,
        playerA.id,
        playerB.id
      );

    if (exists) {
      continue;
    }

    pairingsToCreate.push({
      tournamentId,

      category:
        tournament.category ||
        playerA.category ||
        "",

      round,

      mode: tournament.mode,

      whitePlayerId: playerA.id,
      blackPlayerId: playerB.id,

      availableAt:
        availableAt instanceof Date
          ? availableAt
          : new Date(),
    });
  }

  if (
    pairingsToCreate.length * 2 <
    players.length
  ) {
    const alreadyPairedIds =
      new Set();

    for (const pairing of pairingsToCreate) {
      alreadyPairedIds.add(
        pairing.whitePlayerId
      );

      alreadyPairedIds.add(
        pairing.blackPlayerId
      );
    }

    const remainingPlayers =
      shuffledPlayers.filter(
        (player) =>
          !alreadyPairedIds.has(
            player.id
          )
      );

    for (
      let i = 0;
      i < remainingPlayers.length - 1;
      i += 2
    ) {
      const playerA =
        remainingPlayers[i];

      const playerB =
        remainingPlayers[i + 1];

      const exists =
        await hasExistingPairing(
          tournamentId,
          round,
          tournament.mode,
          playerA.id,
          playerB.id
        );

      if (exists) {
        continue;
      }

      pairingsToCreate.push({
        tournamentId,

        category:
          tournament.category ||
          playerA.category ||
          "",

        round,

        mode: tournament.mode,

        whitePlayerId: playerA.id,
        blackPlayerId: playerB.id,

        availableAt:
          availableAt instanceof Date
            ? availableAt
            : new Date(),
      });
    }
  }

  if (!pairingsToCreate.length) {
    const error = new Error(
      "No new pairings could be generated."
    );

    error.code = "NO_PAIRINGS_GENERATED";
    throw error;
  }

  const createdPairings = [];

  for (const pairing of pairingsToCreate) {
    try {
      const created =
        await prisma.pairing.create({
          data: pairing,

          include: {
            whitePlayer: {
              select: playerSelect,
            },

            blackPlayer: {
              select: playerSelect,
            },

            tournament: {
              select: {
                id: true,
                name: true,
                type: true,
                format: true,
              },
            },
          },
        });

      createdPairings.push(created);

      try {
        await notificationService
          .notifyPairingCreated(created);
      } catch (notificationError) {
        console.error(
          "Pairing notification failed:",
          notificationError
        );
      }
    } catch (error) {
      if (error.code === "P2002") {
        continue;
      }

      throw error;
    }
  }

  return {
    tournamentId,
    round,
    mode: tournament.mode,
    count: createdPairings.length,
    pairings: createdPairings,
  };
}

async function generateTournamentPairings({
  tournamentId,
  round,
  availableAt,
}) {
  tournamentId = Number(tournamentId);
  round = Number(round);

  if (
    !Number.isInteger(tournamentId) ||
    tournamentId <= 0
  ) {
    throw new Error("Invalid tournament ID.");
  }

  if (
    !Number.isInteger(round) ||
    round <= 0
  ) {
    throw new Error("Invalid round.");
  }

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                username: true,
                category: true,
                status: true,
              },
            },
          },
        },
      },
    });

  if (!tournament) {
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  if (tournament.status !== "ACTIVE") {
    throw new Error(
      "Tournament must be ACTIVE before pairings can be generated."
    );
  }

  if (tournament.format === "TEAM_BOARD") {
    throw new Error(
      "TEAM_BOARD tournaments require team pairing generation."
    );
  }

  const players = tournament.players
    .map((entry) => entry.player)
    .filter(
      (player) =>
        player.status === "ACTIVE"
    );

  if (players.length < 2) {
    throw new Error(
      "At least two active players are required."
    );
  }

  // Prevent generating the same round twice.
  const existingPairings =
    await prisma.pairing.findMany({
      where: {
        tournamentId,
        round,
      },

      select: {
        id: true,
        whitePlayerId: true,
        blackPlayerId: true,
      },
    });

  if (existingPairings.length > 0) {
    throw new Error(
      `Pairings for round ${round} already exist.`
    );
  }

  const shuffledPlayers =
    shufflePlayers(players);

  const pairingsToCreate = [];

  for (
    let i = 0;
    i < shuffledPlayers.length - 1;
    i += 2
  ) {
    const white =
      shuffledPlayers[i];

    const black =
      shuffledPlayers[i + 1];

    pairingsToCreate.push({
      tournamentId,
      category: tournament.category || "",
      round,
      mode: tournament.mode,

      whitePlayerId: white.id,
      blackPlayerId: black.id,

      availableAt:
        availableAt instanceof Date
          ? availableAt
          : new Date(),
    });
  }

  if (pairingsToCreate.length === 0) {
    throw new Error(
      "No tournament pairings could be generated."
    );
  }

  const createdPairings = [];

  for (const pairing of pairingsToCreate) {
    const created =
      await prisma.pairing.create({
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

    try {
      await notificationService.notifyPairingCreated(
        created
      );
    } catch (error) {
      console.error(
        "TOURNAMENT PAIRING NOTIFICATION ERROR:",
        error
      );
    }
  }

  return {
    tournamentId,
    round,
    mode: tournament.mode,
    count: createdPairings.length,
    pairings: createdPairings,
  };
}

async function generatePairings({
  category,
  round,
  mode,
  availableAt,
}) {
  if (
    !category ||
    typeof category !== "string"
  ) {
    throw new Error(
      "Category is required."
    );
  }

  category = category.trim();

  if (!category) {
    throw new Error(
      "Category cannot be empty."
    );
  }

  round = validateRound(round);
  validateMode(mode);

  const players =
    await prisma.player.findMany({
      where: {
        status: "ACTIVE",
        category,
      },

      select: playerSelect,

      orderBy: {
        id: "asc",
      },
    });

  if (players.length < 2) {
    throw new Error(
      "At least two active players are required to generate pairings."
    );
  }

  const shuffledPlayers =
    shufflePlayers(players);

  const pairingsToCreate = [];

  for (
    let i = 0;
    i < shuffledPlayers.length - 1;
    i += 2
  ) {
    const playerA =
      shuffledPlayers[i];

    const playerB =
      shuffledPlayers[i + 1];

    const exists =
      await prisma.pairing.findFirst({
        where: {
          category,
          round,
          mode,

          tournamentId: null,

          OR: [
            {
              whitePlayerId: playerA.id,
              blackPlayerId: playerB.id,
            },
            {
              whitePlayerId: playerB.id,
              blackPlayerId: playerA.id,
            },
          ],
        },
      });

    if (exists) {
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

  if (!pairingsToCreate.length) {
    throw new Error(
      "No new pairings could be generated."
    );
  }

  const createdPairings = [];

  for (const pairing of pairingsToCreate) {
    try {
      const created =
        await prisma.pairing.create({
          data: pairing,

          include: {
            whitePlayer: {
              select: playerSelect,
            },

            blackPlayer: {
              select: playerSelect,
            },
          },
        });

      createdPairings.push(created);

      try {
        await notificationService
          .notifyPairingCreated(created);
      } catch (notificationError) {
        console.error(
          "Pairing notification failed:",
          notificationError
        );
      }
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
  playerId = validateId(
    playerId,
    "player ID"
  );

  const where = {
    OR: [
      { whitePlayerId: playerId },
      { blackPlayerId: playerId },
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
    where.round = validateRound(
      options.round
    );
  }

  if (options.category) {
    where.category =
      options.category.trim();
  }

  if (
    options.tournamentId !== undefined &&
    options.tournamentId !== null
  ) {
    where.tournamentId =
      validateId(
        options.tournamentId,
        "tournament ID"
      );
  }

  return prisma.pairing.findMany({
    where,

    include: {
      whitePlayer: {
        select: playerSelect,
      },

      blackPlayer: {
        select: playerSelect,
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

    orderBy: [
      { round: "desc" },
      { availableAt: "desc" },
    ],
  });
}


async function getPairingById(pairingId) {
  pairingId = validateId(
    pairingId,
    "pairing ID"
  );

  return prisma.pairing.findUnique({
    where: {
      id: pairingId,
    },

    include: {
      whitePlayer: {
        select: playerSelect,
      },

      blackPlayer: {
        select: playerSelect,
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
  });
}



async function getAllPairings(filters = {}) {
  const where = {};

  if (filters.category) {
    where.category =
      filters.category.trim();
  }

  if (filters.mode) {
    validateMode(filters.mode);
    where.mode = filters.mode;
  }

  if (
    filters.round !== undefined &&
    filters.round !== null
  ) {
    where.round = validateRound(
      filters.round
    );
  }

  if (
    filters.tournamentId !== undefined &&
    filters.tournamentId !== null
  ) {
    where.tournamentId =
      validateId(
        filters.tournamentId,
        "tournament ID"
      );
  }

  return prisma.pairing.findMany({
    where,

    include: {
      whitePlayer: {
        select: playerSelect,
      },

      blackPlayer: {
        select: playerSelect,
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

    orderBy: [
      { round: "desc" },
      { availableAt: "asc" },
    ],
  });
}


module.exports = {
  generatePairings,
  generateTournamentPairings,
  getPlayerPairings,
  getPairingById,
  getAllPairings,
};
