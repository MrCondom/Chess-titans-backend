const prisma = require("../lib/prisma");

const MAX_ROUNDS = 200;
const MAX_HOURS_PER_ROUND = 720;

const FORMATS = {
  ROUND_ROBIN: "ROUND_ROBIN",
  SWISS: "SWISS",
};

const MODES = {
  RAPID: "RAPID",
  BLITZ: "BLITZ",
  BULLET: "BULLET",
};


function createError(message, code = "PAIRING_ERROR") {
  const error = new Error(message);
  error.code = code;
  return error;
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

  if (!Number.isInteger(rounds) || rounds <= 0) {
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

  return String(category)
    .trim()
    .toUpperCase();
}


function validateOptionalCategory(category) {
  if (
    category === undefined ||
    category === null ||
    String(category).trim() === ""
  ) {
    return null;
  }

  return String(category)
    .trim()
    .toUpperCase();
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


function validateMode(mode) {
  if (
    mode === undefined ||
    mode === null ||
    String(mode).trim() === ""
  ) {
    return MODES.RAPID;
  }

  const cleanMode =
    String(mode)
      .trim()
      .toUpperCase();

  if (
    !Object.values(MODES).includes(
      cleanMode
    )
  ) {
    throw createError(
      "Invalid chess mode. Allowed modes are RAPID, BLITZ, or BULLET.",
      "INVALID_MODE"
    );
  }

  return cleanMode;
}


function shuffle(array) {
  const result = [...array];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

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


async function getAvailableCategories() {
  console.log(
    "🔥 GET AVAILABLE CATEGORIES CALLED"
  );

  const players =
    await prisma.player.findMany({
      where: {
        status: "ACTIVE",
      },

      select: {
        id: true,
        fullName: true,
        username: true,
        category: true,
        status: true,
      },
    });

  const categoryMap = new Map();

  for (const player of players) {
    if (!player.category) {
      continue;
    }

    const category =
      String(player.category).trim();

    if (!category) {
      continue;
    }

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
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name)
      );

  console.log(
    "🔥 AVAILABLE CATEGORIES:",
    categories
  );

  return {
    categories,
  };
}


// ======================================================
// GET ACTIVE PLAYERS FOR A CATEGORY
// ======================================================

async function getPairingPlayers(category) {
  const cleanCategory =
    validateCategory(category);

  console.log(
    `🔥 GET PAIRING PLAYERS: ${cleanCategory}`
  );

  const players =
    await prisma.player.findMany({
      where: {
        status: "ACTIVE",
      },

      select: {
        id: true,
        fullName: true,
        username: true,
        category: true,
        status: true,
      },
    });

  const matchingPlayers =
    players.filter(
      (player) => {
        if (!player.category) {
          return false;
        }

        return (
          String(player.category)
            .trim()
            .toUpperCase() ===
          cleanCategory
        );
      }
    );

  console.log(
    `🔥 PLAYERS IN ${cleanCategory}:`,
    matchingPlayers.map(
      (player) => ({
        id: player.id,
        fullName:
          player.fullName,
        username:
          player.username,
        category:
          player.category,
      })
    )
  );

  if (
    matchingPlayers.length < 2
  ) {
    throw createError(
      `At least 2 active players are required in the ${cleanCategory} category.`,
      "NOT_ENOUGH_PLAYERS"
    );
  }

  return matchingPlayers;
}

function calculateMaximumRounds({
  format,
  participantCount,
}) {
  if (
    format === FORMATS.ROUND_ROBIN
  ) {
    return participantCount % 2 === 0
      ? participantCount - 1
      : participantCount;
  }

  if (
    format === FORMATS.SWISS
  ) {
    return MAX_ROUNDS;
  }

  return 1;
}


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

  if (
    rounds > maximumRounds
  ) {
    throw createError(
      `You requested ${rounds} rounds, but the maximum is ${maximumRounds}.`,
      "ROUND_LIMIT"
    );
  }

  return rounds;
}


function getRoundRobinPairings(
  players,
  round
) {
  let ordered = [
    ...players,
  ];

  if (
    ordered.length % 2 !== 0
  ) {
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
      rotating[
        rotating.length - 1
      ],
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

    if (
      !playerA ||
      !playerB
    ) {
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

function getSwissPairings(
  players
) {
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

    if (
      !playerA ||
      !playerB
    ) {
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

function generateIndividualRound({
  category,
  round,
  players,
  availableAt,
  format,
  mode,
}) {
  let pairings;

  if (
    format ===
    FORMATS.ROUND_ROBIN
  ) {
    pairings =
      getRoundRobinPairings(
        players,
        round
      );
  }

  else if (
    format ===
    FORMATS.SWISS
  ) {
    pairings =
      getSwissPairings(
        players
      );
  }

  else {
    throw createError(
      "Invalid pairing format.",
      "INVALID_FORMAT"
    );
  }

  return pairings.map(
    (pairing) => ({
      ...pairing,

      category,

      round,

      mode,

      availableAt,
    })
  );
}


// ======================================================
// GENERATE AND SAVE PAIRINGS
// ======================================================

async function generatePairings({
  category,
  rounds,
  hoursPerRound,
  availableAt,
  format = FORMATS.ROUND_ROBIN,
  mode = MODES.RAPID,
}) {
  const cleanCategory =
    validateCategory(
      category
    );

  const requestedRounds =
    validateOptionalRounds(
      rounds
    );

  const intervalHours =
    validateHoursPerRound(
      hoursPerRound
    );

  const baseDate =
    validateDate(
      availableAt,
      "availableAt"
    );

  const cleanFormat =
    String(format)
      .trim()
      .toUpperCase();

  if (
    !Object.values(FORMATS).includes(
      cleanFormat
    )
  ) {
    throw createError(
      "Invalid pairing format.",
      "INVALID_FORMAT"
    );
  }

  const cleanMode =
    validateMode(mode);

  const players =
    await getPairingPlayers(
      cleanCategory
    );

  const maximumRounds =
    calculateMaximumRounds({
      format:
        cleanFormat,

      participantCount:
        players.length,
    });

  const totalRounds =
    resolveRounds({
      requestedRounds,

      maximumRounds,
    });

  console.log(
    "🔥 GENERATING AND SAVING PAIRINGS"
  );

  console.log(
    "Category:",
    cleanCategory
  );

  console.log(
    "Mode:",
    cleanMode
  );

  console.log(
    "Players:",
    players.length
  );

  console.log(
    "Rounds:",
    totalRounds
  );

  console.log(
    "Format:",
    cleanFormat
  );

  console.log(
    "Hours per round:",
    intervalHours
  );

  const generatedRounds = [];

  for (
    let index = 0;
    index < totalRounds;
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

    const roundPairings =
      generateIndividualRound({
        category:
          cleanCategory,

        round:
          currentRound,

        players,

        availableAt:
          roundAvailableAt,

        format:
          cleanFormat,

        mode:
          cleanMode,
      });

    if (
      roundPairings.length === 0
    ) {
      throw createError(
        `No pairings could be generated for Round ${currentRound}.`,
        "NO_PAIRINGS"
      );
    }

    generatedRounds.push({
      round:
        currentRound,

      availableAt:
        roundAvailableAt,

      pairings:
        roundPairings,
    });
  }

  const allPairings =
    generatedRounds.flatMap(
      (round) =>
        round.pairings
    );

  if (
    allPairings.length === 0
  ) {
    throw createError(
      "No pairings were generated.",
      "NO_PAIRINGS"
    );
  }

  console.log(
    `🔥 TOTAL PAIRINGS TO SAVE: ${allPairings.length}`
  );

  const savedPairings =
    await prisma.$transaction(
      async (tx) => {

        const deleted =
          await tx.pairing.deleteMany({
            where: {
              category:
                cleanCategory,

              mode:
                cleanMode,
            },
          });

        console.log(
          `🔥 OLD ${cleanCategory} ${cleanMode} PAIRINGS REMOVED: ${deleted.count}`
        );

        await tx.pairing.createMany({
          data:
            allPairings.map(
              (pairing) => ({
                category:
                  pairing.category,

                round:
                  pairing.round,

                mode:
                  pairing.mode,

                whitePlayerId:
                  pairing.whitePlayerId,

                blackPlayerId:
                  pairing.blackPlayerId,

                availableAt:
                  pairing.availableAt,
              })
            ),
        });

        const saved =
          await tx.pairing.findMany({
            where: {
              category:
                cleanCategory,

              mode:
                cleanMode,
            },

            include: {
              whitePlayer: true,
              blackPlayer: true,
            },

            orderBy: [
              {
                round:
                  "asc",
              },

              {
                id:
                  "asc",
              },
            ],
          });

        return saved;
      }
    );

  const savedRounds = [];

  for (
    let round = 1;
    round <= totalRounds;
    round++
  ) {
    const roundPairings =
      savedPairings.filter(
        (pairing) =>
          pairing.round ===
          round
      );

    const firstPairing =
      roundPairings[0];

    savedRounds.push({
      round,

      availableAt:
        firstPairing?.availableAt ||
        generatedRounds[
          round - 1
        ]?.availableAt ||
        null,

      pairings:
        roundPairings,
    });
  }

  console.log(
    `🔥 PAIRINGS SAVED SUCCESSFULLY: ${savedPairings.length}`
  );

  return {
    category:
      cleanCategory,

    mode:
      cleanMode,

    format:
      cleanFormat,

    players:
      players.length,

    maximumRounds,

    rounds:
      totalRounds,

    hoursPerRound:
      intervalHours,

    generatedRounds:
      savedRounds,
  };
}


// ======================================================
// GET PAIRINGS
// ======================================================

async function getPairings({
  round,
  category,
  mode,
}) {
  const where = {};

  if (
    round !== undefined &&
    round !== null &&
    round !== ""
  ) {
    where.round =
      validateRound(
        round
      );
  }

  const cleanCategory =
    validateOptionalCategory(
      category
    );

  if (cleanCategory) {
    where.category =
      cleanCategory;
  }

  const cleanMode =
    mode !== undefined &&
    mode !== null &&
    String(mode).trim() !== ""
      ? validateMode(mode)
      : null;

  if (cleanMode) {
    where.mode =
      cleanMode;
  }

  console.log(
    "🔥 GET PAIRINGS:",
    where
  );

  const pairings =
    await prisma.pairing.findMany({
      where,

      include: {
        whitePlayer: true,
        blackPlayer: true,
      },

      orderBy: [
        {
          round:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    });

  return {
    round:
      round ?? null,

    category:
      cleanCategory,

    mode:
      cleanMode,

    count:
      pairings.length,

    pairings,
  };
}


// ======================================================
// DELETE PAIRINGS
// ======================================================

async function deletePairings({
  round,
  category,
  mode,
}) {
  const where = {};

  if (
    round !== undefined &&
    round !== null &&
    round !== ""
  ) {
    where.round =
      validateRound(
        round
      );
  }

  const cleanCategory =
    validateOptionalCategory(
      category
    );

  if (cleanCategory) {
    where.category =
      cleanCategory;
  }

  const cleanMode =
    mode !== undefined &&
    mode !== null &&
    String(mode).trim() !== ""
      ? validateMode(mode)
      : null;

  if (cleanMode) {
    where.mode =
      cleanMode;
  }

  console.log(
    "🔥 DELETE PAIRINGS:",
    where
  );

  const existing =
    await prisma.pairing.count({
      where,
    });

  if (
    existing === 0
  ) {
    throw createError(
      "No pairings found.",
      "PAIRINGS_NOT_FOUND"
    );
  }

  // ----------------------------------------------------
  // DELETE
  // ----------------------------------------------------

  const deleted =
    await prisma.pairing.deleteMany({
      where,
    });

  return {
    round:
      round ?? null,

    category:
      cleanCategory,

    mode:
      cleanMode,

    deleted:
      deleted.count,
  };
}


const TEAM_PAIRING_MAX_ROUNDS = 200;

function validateTeamId(value, name = "Team ID") {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw createError(
      `Invalid ${name}.`,
      "INVALID_TEAM_ID"
    );
  }

  return id;
}


function validateRequiredTeamMode(mode) {

  if (
    mode === undefined ||
    mode === null ||
    String(mode).trim() === ""
  ) {
    throw createError(
      "Mode is required for team pairing.",
      "MODE_REQUIRED"
    );
  }

  const cleanMode =
    String(mode)
      .trim()
      .toUpperCase();

  if (
    !Object.values(MODES).includes(
      cleanMode
    )
  ) {
    throw createError(
      "Invalid chess mode. Allowed modes are RAPID, BLITZ, or BULLET.",
      "INVALID_MODE"
    );
  }

  return cleanMode;
}

function validateTeamRounds(value) {

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 1;
  }

  const rounds = Number(value);

  if (
    !Number.isInteger(rounds) ||
    rounds <= 0
  ) {
    throw createError(
      "Number of team pairing rounds must be a positive integer.",
      "INVALID_TOTAL_ROUNDS"
    );
  }

  if (
    rounds > TEAM_PAIRING_MAX_ROUNDS
  ) {
    throw createError(
      `Number of rounds cannot exceed ${TEAM_PAIRING_MAX_ROUNDS}.`,
      "ROUND_LIMIT"
    );
  }

  return rounds;
}


// ======================================================
// GET TEAM
// ======================================================

async function getTeamForPairing(
  teamId,
  name
) {

  const id =
    validateTeamId(
      teamId,
      name
    );

  const team =
    await prisma.team.findUnique({
      where: {
        id,
      },

      select: {
        id: true,
        name: true,
        description: true,
        totalPoints: true,
        captainId: true,
      },
    });

  if (!team) {
    throw createError(
      `${name} does not exist.`,
      "TEAM_NOT_FOUND"
    );
  }

  return team;
}


// ======================================================
// GET TEAM PLAYERS
// ======================================================

async function getTeamPlayers(teamId) {

  const id =
    validateTeamId(
      teamId,
      "Team ID"
    );

  const players =
    await prisma.player.findMany({
      where: {
        teamId: id,

        status: "ACTIVE",
      },

      select: {
        id: true,
        fullName: true,
        username: true,
        teamId: true,
        status: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  return players;
}


// ======================================================
// GENERATE TEAM PAIRINGS
// ======================================================

async function generateTeamPairings({
  teamAId,
  teamBId,
  rounds,
  hoursPerRound,
  availableAt,
  mode,
}) {

  const cleanTeamAId =
    validateTeamId(
      teamAId,
      "Team A ID"
    );

  const cleanTeamBId =
    validateTeamId(
      teamBId,
      "Team B ID"
    );


  if (
    cleanTeamAId ===
    cleanTeamBId
  ) {
    throw createError(
      "A team cannot be paired against itself.",
      "SAME_TEAM"
    );
  }

  const cleanMode =
    validateRequiredTeamMode(
      mode
    );

  const totalRounds =
    validateTeamRounds(
      rounds
    );

  const intervalHours =
    validateHoursPerRound(
      hoursPerRound
    );


  const baseDate =
    validateDate(
      availableAt,
      "availableAt"
    );


  const [
    teamA,
    teamB,
  ] = await Promise.all([

    getTeamForPairing(
      cleanTeamAId,
      "Team A"
    ),

    getTeamForPairing(
      cleanTeamBId,
      "Team B"
    ),

  ]);


  const [
    teamAPlayers,
    teamBPlayers,
  ] = await Promise.all([

    getTeamPlayers(
      cleanTeamAId
    ),

    getTeamPlayers(
      cleanTeamBId
    ),

  ]);


  if (
    teamAPlayers.length === 0
  ) {
    throw createError(
      `${teamA.name} has no active players.`,
      "TEAM_A_NO_PLAYERS"
    );
  }


  if (
    teamBPlayers.length === 0
  ) {
    throw createError(
      `${teamB.name} has no active players.`,
      "TEAM_B_NO_PLAYERS"
    );
  }

  const boardCount =
    Math.min(
      teamAPlayers.length,
      teamBPlayers.length
    );


  if (
    boardCount === 0
  ) {
    throw createError(
      "Both teams must have at least one active player.",
      "NOT_ENOUGH_PLAYERS"
    );
  }


  console.log(
    "🔥 GENERATING TEAM PAIRINGS"
  );

  console.log(
    "Team A:",
    teamA.name,
    cleanTeamAId
  );

  console.log(
    "Team B:",
    teamB.name,
    cleanTeamBId
  );

  console.log(
    "Mode:",
    cleanMode
  );

  console.log(
    "Rounds:",
    totalRounds
  );

  console.log(
    "Boards:",
    boardCount
  );

  const saved =
    await prisma.$transaction(
      async (tx) => {

        const existing =
          await tx.teamPairing.findMany({
            where: {
              OR: [
                {
                  teamAId:
                    cleanTeamAId,

                  teamBId:
                    cleanTeamBId,
                },

                {
                  teamAId:
                    cleanTeamBId,

                  teamBId:
                    cleanTeamAId,
                },
              ],

              mode:
                cleanMode,
            },

            select: {
              id: true,
            },
          });


        const existingIds =
          existing.map(
            (item) =>
              item.id
          );


        if (
          existingIds.length > 0
        ) {

          await tx.teamGame.deleteMany({
            where: {
              teamPairingId: {
                in:
                  existingIds,
              },
            },
          });


          await tx.teamPairing.deleteMany({
            where: {
              id: {
                in:
                  existingIds,
              },
            },
          });

        }

        const createdTeamPairings =
          [];


        for (
          let round = 1;
          round <= totalRounds;
          round++
        ) {

          const roundAvailableAt =
            new Date(
              baseDate.getTime() +
              (
                (round - 1) *
                intervalHours *
                60 *
                60 *
                1000
              )
            );


          const teamPairing =
            await tx.teamPairing.create({
              data: {

                teamAId:
                  cleanTeamAId,

                teamBId:
                  cleanTeamBId,

                round,

                mode:
                  cleanMode,

                availableAt:
                  roundAvailableAt,

              },

              include: {
                teamA: true,
                teamB: true,
              },
            });


          createdTeamPairings.push(
            teamPairing
          );

        }


        return createdTeamPairings;

      }
    );


  console.log(
    `🔥 TEAM PAIRINGS SAVED: ${saved.length}`
  );


  return {
    teamA: {
      id:
        teamA.id,

      name:
        teamA.name,
    },

    teamB: {
      id:
        teamB.id,

      name:
        teamB.name,
    },

    mode:
      cleanMode,

    rounds:
      totalRounds,

    hoursPerRound:
      intervalHours,

    boards:
      boardCount,

    pairings:
      saved,
  };
}


// ======================================================
// GENERATE BOARD-TO-BOARD PAIRINGS
// ======================================================

async function generateBoardPairings({
  teamPairingId,
}) {

  const id =
    Number(teamPairingId);


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw createError(
      "Invalid team pairing ID.",
      "INVALID_TEAM_PAIRING_ID"
    );
  }


  // ----------------------------------------------------
  // GET TEAM PAIRING
  // ----------------------------------------------------

  const teamPairing =
    await prisma.teamPairing.findUnique({

      where: {
        id,
      },

      include: {
        teamA: true,
        teamB: true,
      },

    });


  if (!teamPairing) {
    throw createError(
      "Team pairing not found.",
      "TEAM_PAIRING_NOT_FOUND"
    );
  }

  const [
    teamAPlayers,
    teamBPlayers,
  ] = await Promise.all([

    getTeamPlayers(
      teamPairing.teamAId
    ),

    getTeamPlayers(
      teamPairing.teamBId
    ),

  ]);


  const boardCount =
    Math.min(
      teamAPlayers.length,
      teamBPlayers.length
    );


  if (
    boardCount === 0
  ) {
    throw createError(
      "Both teams must have active players for board pairing.",
      "NOT_ENOUGH_PLAYERS"
    );
  }


  console.log(
    "🔥 GENERATING BOARD-TO-BOARD PAIRINGS"
  );

  console.log(
    "Team Pairing:",
    teamPairing.id
  );

  console.log(
    "Boards:",
    boardCount
  );

  console.log(
    "Mode:",
    teamPairing.mode
  );

  const saved =
    await prisma.$transaction(
      async (tx) => {
  
        await tx.teamGame.deleteMany({
          where: {
            teamPairingId: id,
          },
        });

        const games = [];


        for (
          let index = 0;
          index < boardCount;
          index++
        ) {

          const playerA =
            teamAPlayers[index];

          const playerB =
            teamBPlayers[index];

          const teamAIsWhite =
            index % 2 === 0;


          games.push({
            teamPairingId: id,
            boardPosition: index + 1,
            whitePlayerId: teamAIsWhite
              ? playerA.id
              : playerB.id,
            blackPlayerId: teamAIsWhite
              ? playerB.id
              : playerA.id,
            result: null,
          });

        }


        await tx.teamGame.createMany({
          data:
            games,
        });


        const savedGames =
          await tx.teamGame.findMany({

            where: {
              teamPairingId:
                id,
            },

            include: {
              whitePlayer: true,
              blackPlayer: true,
            },

            orderBy: {
              boardPosition:
                "asc",
            },

          });


        return savedGames;

      }
    );


  console.log(
    `🔥 BOARD PAIRINGS SAVED: ${saved.length}`
  );


  return {
    teamPairingId:
      teamPairing.id,

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

    round:
      teamPairing.round,

    mode:
      teamPairing.mode,

    availableAt:
      teamPairing.availableAt,

    boardCount:
      saved.length,

    games:
      saved,
  };
}


// ======================================================
// GET TEAM PAIRINGS
// ======================================================

async function getTeamPairings({
  teamId,
  round,
  mode,
}) {

  const where = {};

  if (
    teamId !== undefined &&
    teamId !== null &&
    teamId !== ""
  ) {

    const cleanTeamId =
      validateTeamId(
        teamId,
        "Team ID"
      );


    where.OR = [
      {
        teamAId:
          cleanTeamId,
      },

      {
        teamBId:
          cleanTeamId,
      },
    ];

  }

  if (
    round !== undefined &&
    round !== null &&
    round !== ""
  ) {

    where.round =
      validateRound(
        round
      );

  }

  if (
    mode !== undefined &&
    mode !== null &&
    String(mode).trim() !== ""
  ) {

    where.mode =
      validateRequiredTeamMode(
        mode
      );

  }


  console.log(
    "🔥 GET TEAM PAIRINGS:",
    where
  );


  const pairings =
    await prisma.teamPairing.findMany({

      where,

      include: {

        teamA: true,

        teamB: true,

        games: {

          include: {

            whitePlayer: true,

            blackPlayer: true,

          },

          orderBy: {
            boardPosition:
              "asc",
          },

        },

      },

      orderBy: [

        {
          round:
            "asc",
        },

        {
          id:
            "asc",
        },

      ],

    });


  return {
    teamId:
      teamId ?? null,

    round:
      round ?? null,

    mode:
      mode
        ? String(mode)
            .trim()
            .toUpperCase()
        : null,

    count:
      pairings.length,

    pairings,
  };
}


// ======================================================
// DELETE TEAM PAIRINGS
// ======================================================

async function deleteTeamPairings({
  teamId,
  round,
  mode,
}) {

  const where = {};

  if (
    teamId !== undefined &&
    teamId !== null &&
    teamId !== ""
  ) {

    const cleanTeamId =
      validateTeamId(
        teamId,
        "Team ID"
      );


    where.OR = [
      {
        teamAId:
          cleanTeamId,
      },

      {
        teamBId:
          cleanTeamId,
      },
    ];

  }

  if (
    round !== undefined &&
    round !== null &&
    round !== ""
  ) {

    where.round =
      validateRound(
        round
      );

  }

  if (
    mode !== undefined &&
    mode !== null &&
    String(mode).trim() !== ""
  ) {

    where.mode =
      validateRequiredTeamMode(
        mode
      );

  }


  console.log(
    "🔥 DELETE TEAM PAIRINGS:",
    where
  );

  const existing =
    await prisma.teamPairing.findMany({

      where,

      select: {
        id: true,
      },

    });


  if (
    existing.length === 0
  ) {
    throw createError(
      "No team pairings found.",
      "TEAM_PAIRINGS_NOT_FOUND"
    );
  }


  const ids =
    existing.map(
      (item) =>
        item.id
    );

  const deleted =
    await prisma.$transaction(
      async (tx) => {

        // Delete board games first.
        await tx.teamGame.deleteMany({
          where: {
            teamPairingId: {
              in:
                ids,
            },
          },
        });


        // Then delete team pairings.
        const result =
          await tx.teamPairing.deleteMany({
            where: {
              id: {
                in:
                  ids,
              },
            },
          });


        return result;

      }
    );


  console.log(
    `🔥 TEAM PAIRINGS DELETED: ${deleted.count}`
  );


  return {
    teamId:
      teamId ?? null,

    round:
      round ?? null,

    mode:
      mode
        ? String(mode)
            .trim()
            .toUpperCase()
        : null,

    deleted:
      deleted.count,
  };
}



// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getAvailableCategories,
  getPairingPlayers,
  generatePairings,
  getPairings,
  deletePairings,
  generateTeamPairings,
  generateBoardPairings,
  getTeamPairings,
  deleteTeamPairings,
};
