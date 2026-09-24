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
    return maximumRounds;
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


function buildCompleteRoundRobinSchedule(players) {
  if (!Array.isArray(players) || players.length < 2) {
    return [];
  }

  /*
   * TRUE SINGLE ROUND ROBIN
   *
   * Every player plays every other player exactly once.
   *
   * Even number of players:
   *   N players = N - 1 rounds
   *
   * Odd number of players:
   *   N players = N rounds
   *   One player receives a bye each round.
   *
   * Example:
   *
   * A B C D E
   *
   * becomes:
   *
   * A B C D E BYE
   *
   * The BYE is treated as a dummy player.
   */

  const orderedPlayers = [...players];

  if (orderedPlayers.length % 2 !== 0) {
    orderedPlayers.push(null);
  }

  const playerCount = orderedPlayers.length;
  const totalRounds = playerCount - 1;
  const gamesPerRound = playerCount / 2;

  /*
   * We use the circle method.
   *
   * Position 0 remains fixed.
   * All other positions rotate.
   *
   * This guarantees that every possible pair
   * appears exactly once.
   */

  const schedule = [];

  let current = [...orderedPlayers];

  for (
    let round = 1;
    round <= totalRounds;
    round++
  ) {
    const pairings = [];

    /*
     * Pair the first player with the last,
     * second with second-last, etc.
     */
    for (
      let i = 0;
      i < gamesPerRound;
      i++
    ) {
      const playerA = current[i];

      const playerB =
        current[playerCount - 1 - i];

      /*
       * One side can be the BYE.
       * That player simply doesn't get a game.
       */
      if (!playerA || !playerB) {
        continue;
      }

      pairings.push({
        whitePlayerId: playerA.id,
        blackPlayerId: playerB.id,
      });
    }

    schedule.push({
      round,
      pairings,
    });

    const fixed = current[0];

    const rotating = current.slice(1);

    rotating.unshift(
      rotating.pop()
    );

    current = [
      fixed,
      ...rotating,
    ];
  }

  return schedule;
}


function getRoundRobinPairings(
  players,
  round
) {
  const schedule =
    buildCompleteRoundRobinSchedule(
      players
    );

  if (
    round < 1 ||
    round > schedule.length
  ) {
    throw createError(
      `Round ${round} is outside the valid round-robin range of 1-${schedule.length}.`,
      "INVALID_ROUND_ROBIN_ROUND"
    );
  }

  return schedule[round - 1].pairings;
}


function validateCompleteRoundRobin(
  players,
  generatedRounds
) {
  const expectedGames =
    (
      players.length *
      (players.length - 1)
    ) / 2;

  const playedPairs =
    new Set();

  const playerIds =
    new Set(
      players.map(
        (player) => player.id
      )
    );

  for (
    const round of generatedRounds
  ) {
    const playersInRound =
      new Set();

    for (
      const pairing of round.pairings
    ) {
      const white =
        pairing.whitePlayerId;

      const black =
        pairing.blackPlayerId;

      if (
        !playerIds.has(white) ||
        !playerIds.has(black)
      ) {
        throw createError(
          `Invalid player found in Round ${round.round}.`,
          "INVALID_ROUND_ROBIN_PLAYER"
        );
      }
      
      if (
        playersInRound.has(white)
      ) {
        throw createError(
          `Player ${white} appears more than once in Round ${round.round}.`,
          "PLAYER_REPEATED_IN_ROUND"
        );
      }

      if (
        playersInRound.has(black)
      ) {
        throw createError(
          `Player ${black} appears more than once in Round ${round.round}.`,
          "PLAYER_REPEATED_IN_ROUND"
        );
      }

      playersInRound.add(white);
      playersInRound.add(black);

      /*
       * Treat A-B and B-A as the SAME pairing.
       */
      const pairKey =
        [white, black]
          .sort(
            (a, b) => a - b
          )
          .join(":");

    
      if (
        playedPairs.has(pairKey)
      ) {
        throw createError(
          `Duplicate round-robin pairing detected: players ${white} and ${black} have already played.`,
          "DUPLICATE_ROUND_ROBIN_PAIR"
        );
      }

      playedPairs.add(pairKey);
    }
  }


  if (
    playedPairs.size !== expectedGames
  ) {
    throw createError(
      `Invalid round-robin schedule. Expected ${expectedGames} unique games, but generated ${playedPairs.size}.`,
      "INCOMPLETE_ROUND_ROBIN"
    );
  }


  for (
    let i = 0;
    i < players.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < players.length;
      j++
    ) {
      const playerA =
        players[i].id;

      const playerB =
        players[j].id;

      const pairKey =
        [playerA, playerB]
          .sort(
            (a, b) => a - b
          )
          .join(":");

      if (
        !playedPairs.has(pairKey)
      ) {
        throw createError(
          `Missing round-robin pairing between players ${playerA} and ${playerB}.`,
          "MISSING_ROUND_ROBIN_PAIR"
        );
      }
    }
  }

  return true;
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

  if (
    cleanFormat === FORMATS.ROUND_ROBIN
  ) {
   
    validateCompleteRoundRobin(
      players,
      generatedRounds
    );
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
