const prisma = require("../lib/prisma");

const SPECIAL_TOURNAMENT_TYPE = "SPECIAL";

const VALID_FORMATS = ["SWISS", "ROUND_ROBIN"];
const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateTournamentId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid tournament ID.");
  }

  return id;
}

function validatePlayerId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError("Invalid player ID.");
  }

  return id;
}

function validateName(name) {
  if (typeof name !== "string") {
    throw createError("Tournament name is required.");
  }

  const cleanName = name.trim();

  if (!cleanName) {
    throw createError("Tournament name cannot be empty.");
  }

  if (cleanName.length > 150) {
    throw createError("Tournament name cannot exceed 150 characters.");
  }

  return cleanName;
}

function validateFormat(format) {
  const cleanFormat = String(format || "ROUND_ROBIN").trim().toUpperCase();

  if (!VALID_FORMATS.includes(cleanFormat)) {
    throw createError(
      `Invalid tournament format. Use ${VALID_FORMATS.join(" or ")}.`
    );
  }

  return cleanFormat;
}

function validateMode(mode) {
  const cleanMode = String(mode || "RAPID").trim().toUpperCase();

  if (!VALID_MODES.includes(cleanMode)) {
    throw createError(
      `Invalid game mode. Use ${VALID_MODES.join(", ")}.`
    );
  }

  return cleanMode;
}

function validateRounds(value) {
  const rounds = Number(value ?? 1);

  if (!Number.isInteger(rounds) || rounds < 1) {
    throw createError("Total rounds must be a positive integer.");
  }

  return rounds;
}

function validateRoundDuration(value) {
  const minutes = Number(value ?? 0);

  if (!Number.isInteger(minutes) || minutes < 0) {
    throw createError(
      "Round duration must be a non-negative integer."
    );
  }

  return minutes;
}

function validateDate(value) {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError("Invalid tournament start date.");
  }

  return date;
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Creates a special tournament.
 *
 * Players are NOT automatically added here.
 * They join separately through joinSpecialTournament().
 */
async function createSpecialTournament({
  name,
  mode = "RAPID",
  format = "ROUND_ROBIN",
  totalRounds = 1,
  roundDurationMinutes = 0,
  startedAt = null,
}) {
  const cleanName = validateName(name);
  const cleanMode = validateMode(mode);
  const cleanFormat = validateFormat(format);
  const rounds = validateRounds(totalRounds);
  const duration = validateRoundDuration(roundDurationMinutes);

  const startDate = validateDate(startedAt);

  const tournament = await prisma.tournament.create({
    data: {
      name: cleanName,
      type: SPECIAL_TOURNAMENT_TYPE,
      mode: cleanMode,
      format: cleanFormat,
      status: "DRAFT",
      totalRounds: rounds,
      currentRound: 0,
      roundDurationMinutes: duration,
      startedAt: startDate,
    },
  });

  return tournament;
}

/**
 * Gets one special tournament.
 */
async function getSpecialTournament(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              username: true,
              fullName: true,
              status: true,
              category: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },
      pairings: {
        include: {
          whitePlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
          blackPlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
        orderBy: [
          {
            round: "asc",
          },
          {
            id: "asc",
          },
        ],
      },
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  return tournament;
}

/**
 * Gets all ACTIVE players.
 *
 * This does NOT automatically mean they have joined
 * a special tournament.
 */
async function getActivePlayers() {
  return prisma.player.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      status: true,
      category: true,
      rapidRating: true,
      blitzRating: true,
      bulletRating: true,
    },
    orderBy: {
      fullName: "asc",
    },
  });
}

/**
 * Player joins a particular special tournament.
 */
async function joinSpecialTournament(tournamentId, playerId) {
  const tournamentIdNumber = validateTournamentId(tournamentId);
  const playerIdNumber = validatePlayerId(playerId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id: tournamentIdNumber,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  if (tournament.status !== "DRAFT" && tournament.status !== "ACTIVE") {
    throw createError(
      "Players cannot join a completed or cancelled tournament."
    );
  }

  const player = await prisma.player.findUnique({
    where: {
      id: playerIdNumber,
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      status: true,
    },
  });

  if (!player) {
    throw createError("Player not found.", 404);
  }

  if (player.status !== "ACTIVE") {
    throw createError(
      "Only ACTIVE players can participate in a special tournament."
    );
  }

  const existing = await prisma.tournamentPlayer.findUnique({
    where: {
      tournamentId_playerId: {
        tournamentId: tournamentIdNumber,
        playerId: playerIdNumber,
      },
    },
  });

  if (existing) {
    throw createError("Player has already joined this tournament.");
  }

  const participant = await prisma.tournamentPlayer.create({
    data: {
      tournamentId: tournamentIdNumber,
      playerId: playerIdNumber,
    },
    include: {
      player: {
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
          category: true,
          rapidRating: true,
          blitzRating: true,
          bulletRating: true,
        },
      },
    },
  });

  return participant;
}

/**
 * Player leaves a particular special tournament.
 */
async function leaveSpecialTournament(tournamentId, playerId) {
  const tournamentIdNumber = validateTournamentId(tournamentId);
  const playerIdNumber = validatePlayerId(playerId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id: tournamentIdNumber,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  if (tournament.status !== "DRAFT") {
    throw createError(
      "Players can only leave a special tournament while it is in DRAFT status."
    );
  }

  const participant = await prisma.tournamentPlayer.findUnique({
    where: {
      tournamentId_playerId: {
        tournamentId: tournamentIdNumber,
        playerId: playerIdNumber,
      },
    },
  });

  if (!participant) {
    throw createError("Player is not participating in this tournament.", 404);
  }

  await prisma.tournamentPlayer.delete({
    where: {
      tournamentId_playerId: {
        tournamentId: tournamentIdNumber,
        playerId: playerIdNumber,
      },
    },
  });

  return {
    success: true,
    message: "Player left the special tournament.",
  };
}


/**
 * Admin adds an ACTIVE player to a special tournament.
 *
 * Players can only be added while the tournament is DRAFT.
 */
async function addPlayerToSpecialTournament(
  tournamentId,
  playerId
) {
  const tournamentIdNumber =
    validateTournamentId(tournamentId);

  const playerIdNumber =
    validatePlayerId(playerId);

  const tournament =
    await prisma.tournament.findFirst({
      where: {
        id: tournamentIdNumber,
        type: SPECIAL_TOURNAMENT_TYPE,
      },
    });

  if (!tournament) {
    throw createError(
      "Special tournament not found.",
      404
    );
  }

  // Players are locked once pairings have been generated.
  if (tournament.status !== "DRAFT") {
    throw createError(
      "Players can only be added while the tournament is in DRAFT status."
    );
  }

  const player =
    await prisma.player.findUnique({
      where: {
        id: playerIdNumber,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        status: true,
        category: true,
        rapidRating: true,
        blitzRating: true,
        bulletRating: true,
      },
    });

  if (!player) {
    throw createError(
      "Player not found.",
      404
    );
  }

  if (player.status !== "ACTIVE") {
    throw createError(
      "Only ACTIVE players can be added to a special tournament."
    );
  }

  const existing =
    await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournamentIdNumber,
          playerId: playerIdNumber,
        },
      },
    });

  if (existing) {
    throw createError(
      "Player is already participating in this tournament."
    );
  }

  const participant =
    await prisma.tournamentPlayer.create({
      data: {
        tournamentId: tournamentIdNumber,
        playerId: playerIdNumber,
      },
      include: {
        player: {
          select: {
            id: true,
            username: true,
            fullName: true,
            status: true,
            category: true,
            rapidRating: true,
            blitzRating: true,
            bulletRating: true,
          },
        },
      },
    });

  return participant;
}


/**
 * Admin removes a player from a special tournament.
 *
 * Players can only be removed while the tournament is DRAFT.
 */
async function removePlayerFromSpecialTournament(
  tournamentId,
  playerId
) {
  const tournamentIdNumber =
    validateTournamentId(tournamentId);

  const playerIdNumber =
    validatePlayerId(playerId);

  const tournament =
    await prisma.tournament.findFirst({
      where: {
        id: tournamentIdNumber,
        type: SPECIAL_TOURNAMENT_TYPE,
      },
    });

  if (!tournament) {
    throw createError(
      "Special tournament not found.",
      404
    );
  }

  // Once pairings exist, participants are locked.
  if (tournament.status !== "DRAFT") {
    throw createError(
      "Players can only be removed while the tournament is in DRAFT status."
    );
  }

  const participant =
    await prisma.tournamentPlayer.findUnique({
      where: {
        tournamentId_playerId: {
          tournamentId: tournamentIdNumber,
          playerId: playerIdNumber,
        },
      },
    });

  if (!participant) {
    throw createError(
      "Player is not participating in this tournament.",
      404
    );
  }

  await prisma.tournamentPlayer.delete({
    where: {
      tournamentId_playerId: {
        tournamentId: tournamentIdNumber,
        playerId: playerIdNumber,
      },
    },
  });

  return {
    success: true,
    message: "Player removed from the special tournament.",
  };
}
/**
 * Gets participants for one special tournament.
 */
async function getTournamentParticipants(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  const participants = await prisma.tournamentPlayer.findMany({
    where: {
      tournamentId: id,
    },
    include: {
      player: {
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
          category: true,
          rapidRating: true,
          blitzRating: true,
          bulletRating: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  });

  return participants;
}

/**
 * Generate a round-robin round.
 */
function generateRoundRobinRound(players, round) {
  let list = [...players];

  // Add a bye for odd number of players.
  if (list.length % 2 !== 0) {
    list.push(null);
  }

  const numberOfPlayers = list.length;
  const half = numberOfPlayers / 2;

  const pairings = [];

  for (let i = 0; i < half; i++) {
    const white = list[i];
    const black = list[numberOfPlayers - 1 - i];

    if (!white || !black) {
      continue;
    }

    // Alternate colors between rounds.
    if (round % 2 === 0) {
      pairings.push({
        whitePlayerId: black.id,
        blackPlayerId: white.id,
      });
    } else {
      pairings.push({
        whitePlayerId: white.id,
        blackPlayerId: black.id,
      });
    }
  }

  // Circle method rotation.
  const fixed = list[0];
  const rotating = list.slice(1);

  const rotated = [
    rotating[rotating.length - 1],
    ...rotating.slice(0, rotating.length - 1),
  ];

  return {
    pairings,
    nextPlayers: [fixed, ...rotated],
  };
}

/**
 * Generate all round-robin rounds.
 */
function generateAllRoundRobinRounds(players, totalRounds) {
  let currentPlayers = [...players];

  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    const result = generateRoundRobinRound(
      currentPlayers,
      round
    );

    rounds.push({
      round,
      pairings: result.pairings,
    });

    currentPlayers = result.nextPlayers;
  }

  return rounds;
}

/**
 * Generate one random Swiss-style round.
 *
 * This follows the pairing behavior of your current pairing service.
 * It does not yet implement full FIDE Swiss score/opponent history.
 */
function generateSwissRounds(players, totalRounds) {
  const rounds = [];

  for (let round = 1; round <= totalRounds; round++) {
    const shuffled = shuffle(players);

    const pairings = [];

    for (let i = 0; i < shuffled.length - 1; i += 2) {
      pairings.push({
        whitePlayerId: shuffled[i].id,
        blackPlayerId: shuffled[i + 1].id,
      });
    }

    rounds.push({
      round,
      pairings,
    });
  }

  return rounds;
}

/**
 * Generates and saves pairings for a special tournament.
 *
 * Only players already registered in TournamentPlayer
 * are used.
 */
async function generateSpecialTournamentPairings(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              username: true,
              fullName: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  if (
    tournament.status !== "DRAFT" &&
    tournament.status !== "ACTIVE"
  ) {
    throw createError(
      "Pairings cannot be generated for a completed or cancelled tournament."
    );
  }

  if (tournament.players.length < 2) {
    throw createError(
      "At least 2 players are required to generate pairings."
    );
  }

  const players = tournament.players
    .map((entry) => entry.player)
    .filter((player) => player.status === "ACTIVE");

  if (players.length < 2) {
    throw createError(
      "At least 2 ACTIVE players are required to generate pairings."
    );
  }

  if (players.length !== tournament.players.length) {
    throw createError(
      "Some tournament participants are no longer ACTIVE. Remove them before generating pairings."
    );
  }

  let rounds;

  if (tournament.format === "ROUND_ROBIN") {
    const maximumRounds =
      players.length % 2 === 0
        ? players.length - 1
        : players.length;

    if (tournament.totalRounds > maximumRounds) {
      throw createError(
        `A round-robin tournament with ${players.length} players can have at most ${maximumRounds} rounds.`
      );
    }

    rounds = generateAllRoundRobinRounds(
      players,
      tournament.totalRounds
    );
  } else if (tournament.format === "SWISS") {
    rounds = generateSwissRounds(
      players,
      tournament.totalRounds
    );
  } else {
    throw createError(
      `Format ${tournament.format} is not supported by special tournaments.`
    );
  }

  const availableAt = tournament.startedAt
    ? new Date(tournament.startedAt)
    : new Date();

  const pairingData = [];

  for (const round of rounds) {
    for (const pairing of round.pairings) {
      pairingData.push({
        category: "SPECIAL",
        round: round.round,
        mode: tournament.mode,
        tournamentId: tournament.id,
        whitePlayerId: pairing.whitePlayerId,
        blackPlayerId: pairing.blackPlayerId,
        availableAt,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing pairings for THIS tournament only.
    await tx.pairing.deleteMany({
      where: {
        tournamentId: tournament.id,
      },
    });

    if (pairingData.length > 0) {
      await tx.pairing.createMany({
        data: pairingData,
      });
    }

    await tx.tournament.update({
      where: {
        id: tournament.id,
      },
      data: {
        status: "ACTIVE",
        currentRound: 1,
      },
    });
  });

  return getSpecialTournament(tournament.id);
}

/**
 * Gets pairings belonging to one special tournament.
 */
async function getSpecialTournamentPairings(
  tournamentId,
  round = null
) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  const where = {
    tournamentId: id,
  };

  if (round !== null && round !== undefined) {
    const cleanRound = Number(round);

    if (!Number.isInteger(cleanRound) || cleanRound < 1) {
      throw createError("Invalid round.");
    }

    where.round = cleanRound;
  }

  const pairings = await prisma.pairing.findMany({
    where,
    include: {
      whitePlayer: {
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
        },
      },
      blackPlayer: {
        select: {
          id: true,
          username: true,
          fullName: true,
          status: true,
        },
      },
    },
    orderBy: [
      {
        round: "asc",
      },
      {
        id: "asc",
      },
    ],
  });

  return pairings;
}

/**
 * Deletes ONLY pairings belonging to the special tournament.
 *
 * The tournament itself and TournamentPlayer records remain.
 */
async function deleteSpecialTournamentPairings(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
  });

  if (!tournament) {
    throw createError("Special tournament not found.", 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    const deleted = await tx.pairing.deleteMany({
      where: {
        tournamentId: id,
      },
    });

    await tx.tournament.update({
      where: {
        id,
      },
      data: {
        status: "DRAFT",
        currentRound: 0,
      },
    });

    return deleted;
  });

  return {
    success: true,
    message: "Special tournament pairings deleted.",
    deletedCount: result.count,
  };
}

/**
 * Gets all special tournaments.
 */
async function getAllSpecialTournaments() {
  return prisma.tournament.findMany({
    where: {
      type: SPECIAL_TOURNAMENT_TYPE,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              username: true,
              fullName: true,
              status: true,
              category: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      },

      pairings: {
        include: {
          whitePlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },

          blackPlayer: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },

        orderBy: [
          {
            round: "asc",
          },
          {
            id: "asc",
          },
        ],
      },
    },
  });
}

async function deleteSpecialTournament(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament = await prisma.tournament.findFirst({
    where: {
      id,
      type: SPECIAL_TOURNAMENT_TYPE,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!tournament) {
    throw createError(
      "Special tournament not found.",
      404
    );
  }

 
  if (
    tournament.status !== "DRAFT" &&
    tournament.status !== "CANCELLED"
  ) {
    throw createError(
      `A ${tournament.status.toLowerCase()} special tournament cannot be deleted.`
    );
  }

  await prisma.$transaction(async (tx) => {
    
    await tx.pairing.deleteMany({
      where: {
        tournamentId: id,
      },
    });

    await tx.tournamentPlayer.deleteMany({
      where: {
        tournamentId: id,
      },
    });

    // ------------------------------------------------
    // DELETE TOURNAMENT
    // ------------------------------------------------

    await tx.tournament.delete({
      where: {
        id,
      },
    });
  });

  return {
    success: true,
    message: `Special tournament "${tournament.name}" deleted successfully.`,
    tournamentId: id,
  };
}

module.exports = {
  createSpecialTournament,
  getAllSpecialTournaments,
  getSpecialTournament,
  getActivePlayers,
  joinSpecialTournament,
  leaveSpecialTournament,
  getTournamentParticipants,
  addPlayerToSpecialTournament,
  removePlayerFromSpecialTournament,
  generateSpecialTournamentPairings,
  getSpecialTournamentPairings,
  deleteSpecialTournamentPairings,
  deleteSpecialTournament,
};