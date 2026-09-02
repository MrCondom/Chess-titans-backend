const prisma = require("../lib/prisma");

// ======================================================
// CONSTANTS
// ======================================================

const MAX_ROUNDS = 200;
const MAX_HOURS_PER_ROUND = 720;

const TOURNAMENT_TYPES = {
  INDIVIDUAL: "INDIVIDUAL",
  TEAM: "TEAM",
  SPECIAL: "SPECIAL",
};

const FORMATS = {
  ROUND_ROBIN: "ROUND_ROBIN",
  SWISS: "SWISS",
};

const TEAM_MODES = {
  TEAM_VS_TEAM: "TEAM_VS_TEAM",
  TEAM_BOARD: "TEAM_BOARD",
};


// ======================================================
// ERROR HELPER
// ======================================================

function createError(message, code = "PAIRING_ERROR") {
  const error = new Error(message);

  error.code = code;

  return error;
}


// ======================================================
// VALIDATION
// ======================================================

function validateId(value, name = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw createError(
      `Invalid ${name}.`,
      "INVALID_ID"
    );
  }

  return id;
}


function validateRound(value) {
  const round = Number(value);

  if (!Number.isInteger(round) || round <= 0) {
    throw createError(
      "Round must be a positive integer.",
      "INVALID_ROUND"
    );
  }

  if (round > MAX_ROUNDS) {
    throw createError(
      `Round cannot exceed ${MAX_ROUNDS}.`,
      "ROUND_LIMIT"
    );
  }

  return round;
}


function validateOptionalRounds(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const rounds = Number(value);

  if (
    !Number.isInteger(rounds) ||
    rounds <= 0
  ) {
    throw createError(
      "Number of rounds must be a positive integer.",
      "INVALID_TOTAL_ROUNDS"
    );
  }

  if (rounds > MAX_ROUNDS) {
    throw createError(
      `Number of rounds cannot exceed ${MAX_ROUNDS}.`,
      "ROUND_LIMIT"
    );
  }

  return rounds;
}


function validateHoursPerRound(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const hours = Number(value);

  if (
    !Number.isFinite(hours) ||
    hours < 0 ||
    hours > MAX_HOURS_PER_ROUND
  ) {
    throw createError(
      `hoursPerRound must be between 0 and ${MAX_HOURS_PER_ROUND}.`,
      "INVALID_ROUND_INTERVAL"
    );
  }

  return hours;
}


function validateCategory(category) {
  if (
    category === undefined ||
    category === null ||
    String(category).trim() === ""
  ) {
    throw createError(
      "Category is required.",
      "CATEGORY_REQUIRED"
    );
  }

  return String(category).trim();
}


function validateOptionalCategory(category) {
  if (
    category === undefined ||
    category === null ||
    String(category).trim() === ""
  ) {
    return null;
  }

  return String(category).trim();
}


function validateDate(value, name = "date") {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createError(
      `Invalid ${name}.`,
      "INVALID_DATE"
    );
  }

  return date;
}


// ======================================================
// SHUFFLE
// ======================================================

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j =
      Math.floor(Math.random() * (i + 1));

    [
      result[i],
      result[j],
    ] = [
      result[j],
      result[i],
    ];
  }

  return result;
}


// ======================================================
// TOURNAMENT
// ======================================================

async function getTournament(tournamentId) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },
    });

  if (!tournament) {
    throw createError(
      "Tournament not found.",
      "TOURNAMENT_NOT_FOUND"
    );
  }

  return tournament;
}


function ensureTournamentActive(tournament) {
  if (
    tournament.status &&
    tournament.status !== "ACTIVE"
  ) {
    throw createError(
      "Tournament must be ACTIVE before pairings can be generated.",
      "TOURNAMENT_NOT_ACTIVE"
    );
  }
}


// ======================================================
// TOURNAMENT PLAYERS
// ======================================================

async function getTournamentPlayers(tournamentId) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournamentPlayers =
    await prisma.tournamentPlayer.findMany({
      where: {
        tournamentId,
      },

      select: {
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
    });

  return tournamentPlayers
    .map((entry) => entry.player)
    .filter(Boolean);
}


// ======================================================
// GET AVAILABLE CATEGORIES
//
// GET /pairings/categories?tournamentId=1
//
// Response:
//
// {
//   tournamentId: 1,
//   categories: [
//     {
//       name: "HEAVYWEIGHT",
//       playerCount: 8,
//       canGenerate: true
//     }
//   ]
// }
// ======================================================

async function getAvailableCategories({
  tournamentId,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await getTournament(
      tournamentId
    );

  const players =
    await getTournamentPlayers(
      tournamentId
    );

  const categoryMap = new Map();

  for (const player of players) {
    if (!player) continue;

    if (player.status !== "ACTIVE") {
      continue;
    }

    if (
      !player.category ||
      String(player.category).trim() === ""
    ) {
      continue;
    }

    const category =
      String(player.category).trim();

    categoryMap.set(
      category,
      (categoryMap.get(category) || 0) + 1
    );
  }

  const categories =
    [...categoryMap.entries()]
      .map(
        ([name, playerCount]) => ({
          name,
          playerCount,
          canGenerate:
            playerCount >= 2,
        })
      )
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );

  return {
    tournamentId,

    tournamentType:
      tournament.type,

    categories,
  };
}


// ======================================================
// ROUND COUNT
// ======================================================

function calculateMaximumRounds({
  format,
  participantCount,
  tournamentTotalRounds,
}) {
  if (format === FORMATS.ROUND_ROBIN) {
    return participantCount % 2 === 0
      ? participantCount - 1
      : participantCount;
  }

  const tournamentRounds =
    Number(tournamentTotalRounds);

  if (
    Number.isInteger(tournamentRounds) &&
    tournamentRounds > 0
  ) {
    return Math.min(
      tournamentRounds,
      MAX_ROUNDS
    );
  }

  return 1;
}


// ======================================================
// RESOLVE REQUESTED ROUNDS
//
// Important:
// rounds is optional.
//
// If omitted:
// - generate ONLY one round.
//
// If supplied:
// - generate that many rounds.
// ======================================================

function resolveRounds({
  requestedRounds,
  maximumRounds,
}) {
  const rounds =
    validateOptionalRounds(
      requestedRounds
    );

  if (rounds === null) {
    return 1;
  }

  if (rounds > maximumRounds) {
    throw createError(
      `You requested ${rounds} rounds, but this tournament allows a maximum of ${maximumRounds} rounds.`,
      "ROUND_LIMIT"
    );
  }

  return rounds;
}


// ======================================================
// ROUND ROBIN - INDIVIDUAL
// ======================================================

function getRoundRobinPairings(
  players,
  round
) {
  let ordered = [...players];

  if (ordered.length % 2 !== 0) {
    ordered.push(null);
  }

  const fixed =
    ordered[0];

  let rotating =
    ordered.slice(1);

  for (
    let currentRound = 1;
    currentRound < round;
    currentRound++
  ) {
    rotating = [
      rotating[rotating.length - 1],
      ...rotating.slice(
        0,
        rotating.length - 1
      ),
    ];
  }

  const finalOrder = [
    fixed,
    ...rotating,
  ];

  const pairings = [];

  for (
    let i = 0;
    i < finalOrder.length;
    i += 2
  ) {
    const playerA =
      finalOrder[i];

    const playerB =
      finalOrder[i + 1];

    if (!playerA || !playerB) {
      continue;
    }

    pairings.push({
      whitePlayerId:
        playerA.id,

      blackPlayerId:
        playerB.id,
    });
  }

  return pairings;
}


// ======================================================
// SWISS - BASIC
//
// NOTE:
// A complete Swiss implementation requires previous
// results, scores and opponent history.
//
// This version provides deterministic random pairing
// while preserving the service interface.
// ======================================================

function getSwissPairings(players) {
  const ordered =
    shuffle(players);

  const pairings = [];

  for (
    let i = 0;
    i < ordered.length;
    i += 2
  ) {
    const playerA =
      ordered[i];

    const playerB =
      ordered[i + 1];

    if (!playerA || !playerB) {
      continue;
    }

    pairings.push({
      whitePlayerId:
        playerA.id,

      blackPlayerId:
        playerB.id,
    });
  }

  return pairings;
}


// ======================================================
// GENERATE ONE INDIVIDUAL ROUND
// ======================================================

async function generateIndividualRound({
  tournament,
  tournamentId,
  category,
  round,
  players,
  availableAt,
}) {
  if (players.length < 2) {
    throw createError(
      `At least two active players are required in the "${category}" category.`,
      "INSUFFICIENT_PLAYERS"
    );
  }

  const existing =
    await prisma.pairing.count({
      where: {
        tournamentId,
        category,
        round,
      },
    });

  if (existing > 0) {
    throw createError(
      `${category}, Round ${round} pairings already exist.`,
      "PAIRINGS_ALREADY_EXIST"
    );
  }

  let games;

  if (
    tournament.format ===
    FORMATS.ROUND_ROBIN
  ) {
    games =
      getRoundRobinPairings(
        players,
        round
      );
  }

  else if (
    tournament.format ===
    FORMATS.SWISS
  ) {
    games =
      getSwissPairings(players);
  }

  else {
    throw createError(
      `Unsupported tournament format: ${tournament.format}.`,
      "INVALID_TOURNAMENT_FORMAT"
    );
  }

  if (games.length === 0) {
    throw createError(
      `No pairings could be generated for ${category}, Round ${round}.`,
      "NO_PAIRINGS"
    );
  }

  const data =
    games.map((game) => ({
      tournamentId,
      category,
      round,
      mode:
        tournament.mode,
      whitePlayerId:
        game.whitePlayerId,
      blackPlayerId:
        game.blackPlayerId,
      availableAt,
    }));

  const created =
    await prisma.pairing.createMany({
      data,
    });

  return {
    round,
    count:
      created.count,
    availableAt,
  };
}


// ======================================================
// GENERATE INDIVIDUAL PAIRINGS
//
// POST /pairings/generate
//
// Body:
//
// {
//   tournamentId: 1,
//   category: "HEAVYWEIGHT",
//   rounds: 3,
//   hoursPerRound: 2
// }
//
// rounds is OPTIONAL.
// hoursPerRound is OPTIONAL.
// ======================================================

async function generatePairings({
  tournamentId,
  category,
  rounds,
  hoursPerRound,
  availableAt,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  category =
    validateCategory(
      category
    );

  const tournament =
    await getTournament(
      tournamentId
    );

  ensureTournamentActive(
    tournament
  );

  if (
    tournament.type ===
    TOURNAMENT_TYPES.TEAM
  ) {
    throw createError(
      "This is a team tournament. Use the team pairing options.",
      "WRONG_TOURNAMENT_TYPE"
    );
  }

  if (
    tournament.format ===
    "TEAM_BOARD"
  ) {
    throw createError(
      "Team board tournaments require team pairing generation.",
      "WRONG_TOURNAMENT_FORMAT"
    );
  }

  const players =
    (
      await getTournamentPlayers(
        tournamentId
      )
    ).filter(
      (player) =>
        player.status === "ACTIVE" &&
        String(player.category).trim() ===
          category
    );

  if (players.length < 2) {
    throw createError(
      `At least two active players are required in the "${category}" category.`,
      "INSUFFICIENT_PLAYERS"
    );
  }

  const maximumRounds =
    calculateMaximumRounds({
      format:
        tournament.format,

      participantCount:
        players.length,

      tournamentTotalRounds:
        tournament.totalRounds,
    });

  const roundsToGenerate =
    resolveRounds({
      requestedRounds:
        rounds,

      maximumRounds,
    });

  const intervalHours =
    validateHoursPerRound(
      hoursPerRound
    );

  const baseDate =
    validateDate(
      availableAt,
      "availableAt"
    );

  const generatedRounds = [];

  for (
    let index = 0;
    index < roundsToGenerate;
    index++
  ) {
    const currentRound =
      index + 1;

    const roundAvailableAt =
      new Date(
        baseDate.getTime() +
          index *
            intervalHours *
            60 *
            60 *
            1000
      );

    const result =
      await generateIndividualRound({
        tournament,

        tournamentId,

        category,

        round:
          currentRound,

        players,

        availableAt:
          roundAvailableAt,
      });

    generatedRounds.push(
      result
    );
  }

  return {
    tournamentId,

    category,

    format:
      tournament.format,

    mode:
      tournament.mode,

    maximumRounds,

    requestedRounds:
      rounds ?? null,

    hoursPerRound:
      intervalHours,

    generatedRounds,

    count:
      generatedRounds.reduce(
        (sum, item) =>
          sum + item.count,
        0
      ),
  };
}


// ======================================================
// GET INDIVIDUAL PAIRINGS
// ======================================================

async function getPairings({
  tournamentId,
  round,
  category,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  if (round !== undefined) {
    round =
      validateRound(round);
  }

  const tournament =
    await getTournament(
      tournamentId
    );

  const cleanCategory =
    validateOptionalCategory(
      category
    );

  const where = {
    tournamentId,

    ...(round !== undefined
      ? { round }
      : {}),

    ...(cleanCategory
      ? {
          category:
            cleanCategory,
        }
      : {}),
  };

  const pairings =
    await prisma.pairing.findMany({
      where,

      include: {
        whitePlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
            status: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
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

  return {
    tournamentId,

    tournamentType:
      tournament.type,

    category:
      cleanCategory,

    round:
      round ?? null,

    count:
      pairings.length,

    pairings,
  };
}


// ======================================================
// DELETE INDIVIDUAL PAIRINGS
// ======================================================

async function deletePairings({
  tournamentId,
  round,
  category,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round =
    validateRound(round);

  await getTournament(
    tournamentId
  );

  const cleanCategory =
    validateOptionalCategory(
      category
    );

  const where = {
    tournamentId,
    round,

    ...(cleanCategory
      ? {
          category:
            cleanCategory,
        }
      : {}),
  };

  const pairings =
    await prisma.pairing.findMany({
      where,

      select: {
        id: true,
      },
    });

  if (pairings.length === 0) {
    throw createError(
      cleanCategory
        ? `No pairings found for ${cleanCategory}, Round ${round}.`
        : `No pairings found for Round ${round}.`,
      "PAIRINGS_NOT_FOUND"
    );
  }

  const pairingIds =
    pairings.map(
      (pairing) =>
        pairing.id
    );

  const result =
    await prisma.gameResult.findFirst({
      where: {
        pairingId: {
          in:
            pairingIds,
        },
      },

      select: {
        id: true,
      },
    });

  if (result) {
    throw createError(
      "These pairings cannot be deleted because a game result has already been recorded.",
      "PAIRINGS_LOCKED"
    );
  }

  const deleted =
    await prisma.pairing.deleteMany({
      where,
    });

  return {
    tournamentId,
    round,
    category:
      cleanCategory,
    deleted:
      deleted.count,
  };
}


// ======================================================
// TEAM DATA
// ======================================================
//
// IMPORTANT:
// This function currently uses all teams.
//
// If your Prisma schema has a tournament/team relation,
// replace this query with that relation.
//
// I am deliberately NOT inventing a relation name.
// ======================================================

async function getTournamentTeams(
  tournamentId
) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const teams =
    await prisma.team.findMany({
      orderBy: {
        id: "asc",
      },

      select: {
        id: true,
        name: true,
        description: true,
        totalPoints: true,
        captainId: true,
      },
    });

  return teams;
}


// ======================================================
// GET TEAM OPTIONS
//
// GET /pairings/teams?tournamentId=1
// ======================================================

async function getAvailableTeams({
  tournamentId,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await getTournament(
      tournamentId
    );

  if (
    tournament.type !==
    TOURNAMENT_TYPES.TEAM
  ) {
    throw createError(
      "This is not a team tournament.",
      "WRONG_TOURNAMENT_TYPE"
    );
  }

  const teams =
    await getTournamentTeams(
      tournamentId
    );

  return {
    tournamentId,

    tournamentType:
      tournament.type,

    teams,
  };
}


// ======================================================
// TEAM ROUND ROBIN
// ======================================================

function getTeamRoundRobinPairings(
  teams,
  round
) {
  let ordered =
    [...teams];

  if (ordered.length % 2 !== 0) {
    ordered.push(null);
  }

  const fixed =
    ordered[0];

  let rotating =
    ordered.slice(1);

  for (
    let currentRound = 1;
    currentRound < round;
    currentRound++
  ) {
    rotating = [
      rotating[rotating.length - 1],
      ...rotating.slice(
        0,
        rotating.length - 1
      ),
    ];
  }

  const finalOrder = [
    fixed,
    ...rotating,
  ];

  const pairings = [];

  for (
    let i = 0;
    i < finalOrder.length;
    i += 2
  ) {
    const teamA =
      finalOrder[i];

    const teamB =
      finalOrder[i + 1];

    if (!teamA || !teamB) {
      continue;
    }

    pairings.push({
      teamAId:
        teamA.id,

      teamBId:
        teamB.id,
    });
  }

  return pairings;
}


// ======================================================
// GENERATE TEAM VS TEAM
//
// POST /pairings/team/generate
//
// Body:
//
// {
//   tournamentId: 1,
//   rounds: 3,
//   hoursPerRound: 2
// }
//
// ======================================================

async function generateTeamPairings({
  tournamentId,
  rounds,
  hoursPerRound,
  availableAt,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  const tournament =
    await getTournament(
      tournamentId
    );

  ensureTournamentActive(
    tournament
  );

  if (
    tournament.type !==
    TOURNAMENT_TYPES.TEAM
  ) {
    throw createError(
      "Team pairings can only be generated for TEAM tournaments.",
      "WRONG_TOURNAMENT_TYPE"
    );
  }

  const teams =
    await getTournamentTeams(
      tournamentId
    );

  if (teams.length < 2) {
    throw createError(
      "At least two teams are required.",
      "INSUFFICIENT_TEAMS"
    );
  }

  const maximumRounds =
    calculateMaximumRounds({
      format:
        tournament.format,

      participantCount:
        teams.length,

      tournamentTotalRounds:
        tournament.totalRounds,
    });

  const roundsToGenerate =
    resolveRounds({
      requestedRounds:
        rounds,

      maximumRounds,
    });

  const intervalHours =
    validateHoursPerRound(
      hoursPerRound
    );

  const baseDate =
    validateDate(
      availableAt,
      "availableAt"
    );

  const generatedRounds = [];

  for (
    let index = 0;
    index < roundsToGenerate;
    index++
  ) {
    const currentRound =
      index + 1;

    const existing =
      await prisma.teamPairing.count({
        where: {
          tournamentId,
          round:
            currentRound,
        },
      });

    if (existing > 0) {
      throw createError(
        `Team pairings for Round ${currentRound} already exist.`,
        "PAIRINGS_ALREADY_EXIST"
      );
    }

    let pairings;

    if (
      tournament.format ===
      FORMATS.ROUND_ROBIN
    ) {
      pairings =
        getTeamRoundRobinPairings(
          teams,
          currentRound
        );
    }

    else if (
      tournament.format ===
      FORMATS.SWISS
    ) {
      const shuffled =
        shuffle(teams);

      pairings = [];

      for (
        let i = 0;
        i < shuffled.length;
        i += 2
      ) {
        const teamA =
          shuffled[i];

        const teamB =
          shuffled[i + 1];

        if (!teamA || !teamB) {
          continue;
        }

        pairings.push({
          teamAId:
            teamA.id,

          teamBId:
            teamB.id,
        });
      }
    }

    else {
      throw createError(
        `Unsupported team tournament format: ${tournament.format}.`,
        "INVALID_TOURNAMENT_FORMAT"
      );
    }

    if (pairings.length === 0) {
      throw createError(
        `No team pairings could be generated for Round ${currentRound}.`,
        "NO_PAIRINGS"
      );
    }

    const roundAvailableAt =
      new Date(
        baseDate.getTime() +
          index *
            intervalHours *
            60 *
            60 *
            1000
      );

    const data =
      pairings.map(
        (pairing) => ({
          tournamentId,

          round:
            currentRound,

          teamAId:
            pairing.teamAId,

          teamBId:
            pairing.teamBId,

          availableAt:
            roundAvailableAt,
        })
      );

    const created =
      await prisma.teamPairing.createMany({
        data,
      });

    generatedRounds.push({
      round:
        currentRound,

      count:
        created.count,

      availableAt:
        roundAvailableAt,
    });
  }

  return {
    tournamentId,

    format:
      tournament.format,

    maximumRounds,

    requestedRounds:
      rounds ?? null,

    hoursPerRound:
      intervalHours,

    generatedRounds,

    count:
      generatedRounds.reduce(
        (sum, item) =>
          sum + item.count,
        0
      ),
  };
}


// ======================================================
// GET TEAM PAIRINGS
// ======================================================

async function getTeamPairings({
  tournamentId,
  round,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  if (round !== undefined) {
    round =
      validateRound(round);
  }

  await getTournament(
    tournamentId
  );

  const pairings =
    await prisma.teamPairing.findMany({
      where: {
        tournamentId,

        ...(round !== undefined
          ? {
              round,
            }
          : {}),
      },

      include: {
        teamA: {
          select: {
            id: true,
            name: true,
            description: true,
            totalPoints: true,
            captainId: true,
          },
        },

        teamB: {
          select: {
            id: true,
            name: true,
            description: true,
            totalPoints: true,
            captainId: true,
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

  return {
    tournamentId,

    round:
      round ?? null,

    count:
      pairings.length,

    pairings,
  };
}


// ======================================================
// GENERATE TEAM BOARD PAIRINGS
// ======================================================

async function generateTeamTablePairings({
  teamPairingId,
}) {
  teamPairingId =
    validateId(
      teamPairingId,
      "team pairing ID"
    );

  const teamPairing =
    await prisma.teamPairing.findUnique({
      where: {
        id:
          teamPairingId,
      },

      include: {
        teamA: {
          include: {
            memberships: {
              where: {
                status: "ACTIVE",

                boardPosition: {
                  not: null,
                },
              },

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

              orderBy: {
                boardPosition:
                  "asc",
              },
            },
          },
        },

        teamB: {
          include: {
            memberships: {
              where: {
                status: "ACTIVE",

                boardPosition: {
                  not: null,
                },
              },

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

              orderBy: {
                boardPosition:
                  "asc",
              },
            },
          },
        },

        games: {
          select: {
            id: true,
            boardPosition: true,
          },
        },
      },
    });

  if (!teamPairing) {
    throw createError(
      "Team pairing not found.",
      "TEAM_PAIRING_NOT_FOUND"
    );
  }

  const teamAPlayers =
    teamPairing.teamA
      .memberships;

  const teamBPlayers =
    teamPairing.teamB
      .memberships;

  if (
    teamAPlayers.length === 0
  ) {
    throw createError(
      `${teamPairing.teamA.name} has no active players with board positions.`,
      "NO_TEAM_PLAYERS"
    );
  }

  if (
    teamBPlayers.length === 0
  ) {
    throw createError(
      `${teamPairing.teamB.name} has no active players with board positions.`,
      "NO_TEAM_PLAYERS"
    );
  }

  const teamBByBoard =
    new Map();

  for (
    const membership of teamBPlayers
  ) {
    const board =
      Number(
        membership.boardPosition
      );

    teamBByBoard.set(
      board,
      membership.player
    );
  }

  const games = [];

  for (
    const membership of teamAPlayers
  ) {
    const board =
      Number(
        membership.boardPosition
      );

    const playerB =
      teamBByBoard.get(
        board
      );

    if (!playerB) {
      continue;
    }

    games.push({
      teamPairingId,

      boardPosition:
        board,

      whitePlayerId:
        membership.player.id,

      blackPlayerId:
        playerB.id,

      result: 0,
    });
  }

  if (games.length === 0) {
    throw createError(
      "No matching board positions found between the selected teams.",
      "NO_BOARD_MATCHES"
    );
  }

  const existingBoards =
    new Set(
      teamPairing.games.map(
        (game) =>
          Number(
            game.boardPosition
          )
      )
    );

  const newGames =
    games.filter(
      (game) =>
        !existingBoards.has(
          Number(
            game.boardPosition
          )
        )
    );

  if (
    newGames.length === 0
  ) {
    throw createError(
      "Team board pairings already exist.",
      "BOARDS_ALREADY_EXIST"
    );
  }

  const created =
    await prisma.teamGame.createMany({
      data: newGames,
    });

  return {
    teamPairingId,

    tournamentId:
      teamPairing.tournamentId,

    round:
      teamPairing.round,

    teamA: {
      id:
        teamPairing.teamA.id,

      name:
        teamPairing.teamA.name,
    },

    teamB: {
      id:
        teamPairing.teamB.id,

      name:
        teamPairing.teamB.name,
    },

    count:
      created.count,
  };
}


// ======================================================
// GET TEAM BOARD PAIRINGS
// ======================================================

async function getTeamTablePairings({
  teamPairingId,
}) {
  teamPairingId =
    validateId(
      teamPairingId,
      "team pairing ID"
    );

  const teamPairing =
    await prisma.teamPairing.findUnique({
      where: {
        id:
          teamPairingId,
      },

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

        games: {
          include: {
            whitePlayer: {
              select: {
                id: true,
                fullName: true,
                username: true,
                category: true,
                status: true,
              },
            },

            blackPlayer: {
              select: {
                id: true,
                fullName: true,
                username: true,
                category: true,
                status: true,
              },
            },
          },

          orderBy: {
            boardPosition:
              "asc",
          },
        },
      },
    });

  if (!teamPairing) {
    throw createError(
      "Team pairing not found.",
      "TEAM_PAIRING_NOT_FOUND"
    );
  }

  return {
    teamPairingId,

    tournamentId:
      teamPairing.tournamentId,

    round:
      teamPairing.round,

    teamA:
      teamPairing.teamA,

    teamB:
      teamPairing.teamB,

    availableAt:
      teamPairing.availableAt,

    games:
      teamPairing.games,

    count:
      teamPairing.games.length,
  };
}


// ======================================================
// DELETE TEAM PAIRINGS
// ======================================================

async function deleteTeamPairings({
  tournamentId,
  round,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round =
    validateRound(round);

  await getTournament(
    tournamentId
  );

  const pairings =
    await prisma.teamPairing.findMany({
      where: {
        tournamentId,
        round,
      },

      select: {
        id: true,
      },
    });

  if (
    pairings.length === 0
  ) {
    throw createError(
      `No team pairings found for Round ${round}.`,
      "PAIRINGS_NOT_FOUND"
    );
  }

  const pairingIds =
    pairings.map(
      (pairing) =>
        pairing.id
    );

  const existingGames =
    await prisma.teamGame.findFirst({
      where: {
        teamPairingId: {
          in:
            pairingIds,
        },
      },

      select: {
        id: true,
      },
    });

  if (existingGames) {
    throw createError(
      `Team pairings for Round ${round} cannot be deleted because board games already exist.`,
      "PAIRINGS_LOCKED"
    );
  }

  const deleted =
    await prisma.teamPairing.deleteMany({
      where: {
        tournamentId,
        round,
      },
    });

  return {
    tournamentId,

    round,

    deleted:
      deleted.count,
  };
}


async function generateSpecialPairings() {
  throw createError(
    "Special pairing generation requires the actual Special-player Prisma model.",
    "SPECIAL_SCHEMA_REQUIRED"
  );
}


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAvailableCategories,
  getAvailableTeams,
  generatePairings,
  getPairings,
  deletePairings,
  generateTeamPairings,
  getTeamPairings,
  generateTeamTablePairings,
  getTeamTablePairings,
  deleteTeamPairings,
  generateSpecialPairings,
};