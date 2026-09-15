const prisma = require("../lib/prisma");

const APPROVED = "APPROVED";

const VALID_GAME_MODES = [
  "RAPID",
  "BLITZ",
  "BULLET",
];

const VALID_TOURNAMENT_TYPES = [
  "SPECIAL",
];

function validateTournamentId(tournamentId) {
  const id = Number(tournamentId);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("Invalid tournament ID.");
  }

  return id;
}

function validateCategory(category) {
  const value = String(category || "").trim();

  if (!value) {
    throw new Error("Category is required.");
  }

  return value;
}

function validateMode(mode) {
  const value = String(mode || "")
    .trim()
    .toUpperCase();

  if (!VALID_GAME_MODES.includes(value)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }

  return value;
}

function validateTournamentType(type) {
  if (!VALID_TOURNAMENT_TYPES.includes(type)) {
    throw new Error(
      "Only SPECIAL tournaments use Tournament standings."
    );
  }
}

function getGameOutcome(ownScore, opponentScore) {
  const own = Number(ownScore);
  const opponent = Number(opponentScore);

  if (own > opponent) {
    return "WIN";
  }

  if (own < opponent) {
    return "LOSS";
  }

  return "DRAW";
}

function getTieBreakerValue(outcome) {
  if (outcome === "WIN") return 2;
  if (outcome === "DRAW") return 1;
  return 0;
}

function getPlayerPoints(ownScore, opponentScore, tournamentType) {
  const own = Number(ownScore);
  const opponent = Number(opponentScore);

  if (!Number.isFinite(own) || !Number.isFinite(opponent)) {
    return 0;
  }

  if (tournamentType === "SPECIAL") {
    if (own > opponent) return 1;
    if (own < opponent) return 0;
    return 0.5;
  }

  return own;
}

function assignRanks(standings, nameField) {
  let currentRank = 0;
  let previous = null;

  for (let index = 0; index < standings.length; index += 1) {
    const item = standings[index];

    const sameAsPrevious =
      previous &&
      previous.points === item.points &&
      previous.tieBreaker === item.tieBreaker &&
      previous.wins === item.wins;

    if (!sameAsPrevious) {
      currentRank = index + 1;
    }

    item.rank = currentRank;

    previous = item;
  }

  return standings;
}

function sortPlayerStandings(standings) {
  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.tieBreaker !== a.tieBreaker) {
      return b.tieBreaker - a.tieBreaker;
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return a.username.localeCompare(
      b.username,
      undefined,
      { sensitivity: "base" }
    );
  });

  return assignRanks(standings, "username");
}

function sortTeamStandings(standings) {
  standings.sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }

    if (b.tieBreaker !== a.tieBreaker) {
      return b.tieBreaker - a.tieBreaker;
    }

    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }

    return a.name.localeCompare(
      b.name,
      undefined,
      { sensitivity: "base" }
    );
  });

  return assignRanks(standings, "name");
}

async function getTournament(tournamentId) {
  const id = validateTournamentId(tournamentId);

  const tournament =
    await prisma.tournament.findUnique({
      where: { id },

      select: {
        id: true,
        name: true,
        category: true,
        mode: true,
        type: true,
        format: true,
        status: true,
      },
    });

  if (!tournament) {
    const error = new Error(
      "Tournament not found."
    );

    error.code = "TOURNAMENT_NOT_FOUND";

    throw error;
  }

  validateTournamentType(tournament.type);

  return tournament;
}

async function calculateCategoryStandings(
  category,
  mode
) {
  const cleanCategory =
    validateCategory(category);

  const cleanMode = validateMode(mode);

  const pairings =
    await prisma.pairing.findMany({
      where: {
        category: cleanCategory,
        mode: cleanMode,
        tournamentId: null,
      },

      select: {
        id: true,

        whitePlayerId: true,
        blackPlayerId: true,

        whitePlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
            category: true,
            status: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            username: true,
            fullName: true,
            category: true,
            status: true,
          },
        },
      },
    });

  const standingsMap = new Map();

  for (const pairing of pairings) {
    if (
      pairing.whitePlayer &&
      !standingsMap.has(
        pairing.whitePlayerId
      )
    ) {
      standingsMap.set(
        pairing.whitePlayerId,
        {
          playerId: pairing.whitePlayerId,
          username:
            pairing.whitePlayer.username,
          fullName:
            pairing.whitePlayer.fullName,
          category:
            pairing.whitePlayer.category,
          status:
            pairing.whitePlayer.status,

          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          totalRounds: 0,

          tieBreaker: 0,

          lastResultDate: null,
          lastResultId: null,
        }
      );
    }

    if (
      pairing.blackPlayer &&
      !standingsMap.has(
        pairing.blackPlayerId
      )
    ) {
      standingsMap.set(
        pairing.blackPlayerId,
        {
          playerId: pairing.blackPlayerId,
          username:
            pairing.blackPlayer.username,
          fullName:
            pairing.blackPlayer.fullName,
          category:
            pairing.blackPlayer.category,
          status:
            pairing.blackPlayer.status,

          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          totalRounds: 0,

          tieBreaker: 0,

          lastResultDate: null,
          lastResultId: null,
        }
      );
    }
  }

  const results =
    await prisma.gameResult.findMany({
      where: {
        approvalStatus: APPROVED,

        category: cleanCategory,
        mode: cleanMode,

        pairing: {
          tournamentId: null,
          category: cleanCategory,
          mode: cleanMode,
        },
      },

      select: {
        id: true,
        round: true,
        mode: true,

        whitePlayerId: true,
        blackPlayerId: true,

        whiteScore: true,
        blackScore: true,

        date: true,
        pairingId: true,
      },

      orderBy: [
        { date: "asc" },
        { id: "asc" },
      ],
    });

  for (const result of results) {
    const white =
      standingsMap.get(result.whitePlayerId);

    const black =
      standingsMap.get(result.blackPlayerId);

    if (!white && !black) {
      continue;
    }

    if (white) {
      const outcome =
        getGameOutcome(
          result.whiteScore,
          result.blackScore
        );

      white.points += getPlayerPoints(
        result.whiteScore,
        result.blackScore,
        "CATEGORY"
      );

      white.totalRounds += 1;

      if (outcome === "WIN") {
        white.wins += 1;
      } else if (outcome === "DRAW") {
        white.draws += 1;
      } else {
        white.losses += 1;
      }

      // Tie-breaker is based on the LAST approved
      // played result.
      white.tieBreaker =
        getTieBreakerValue(outcome);

      white.lastResultDate = result.date;
      white.lastResultId = result.id;
    }

    if (black) {
      const outcome =
        getGameOutcome(
          result.blackScore,
          result.whiteScore
        );

      black.points += getPlayerPoints(
        result.blackScore,
        result.whiteScore,
        "CATEGORY"
      );

      black.totalRounds += 1;

      if (outcome === "WIN") {
        black.wins += 1;
      } else if (outcome === "DRAW") {
        black.draws += 1;
      } else {
        black.losses += 1;
      }

      // Tie-breaker is based on the LAST approved
      // played result.
      black.tieBreaker =
        getTieBreakerValue(outcome);

      black.lastResultDate = result.date;
      black.lastResultId = result.id;
    }
  }

  const standings =
    Array.from(
      standingsMap.values()
    );

  sortPlayerStandings(standings);

  return {
    category: cleanCategory,
    mode: cleanMode,
    standings,
  };
}

async function saveCategoryStandings(
  category,
  mode
) {
  const cleanCategory =
    validateCategory(category);

  const cleanMode = validateMode(mode);

  const {
    standings,
  } = await calculateCategoryStandings(
    cleanCategory,
    cleanMode
  );

  await prisma.$transaction(
    async (tx) => {

      await tx.playerRanking.deleteMany({
        where: {
          category: cleanCategory,
          mode: cleanMode,
          tournamentId: null,
        },
      });

      if (standings.length === 0) {
        return;
      }

      const data = standings.map(
        (item) => ({
          playerId: Number(
            item.playerId
          ),

          category: cleanCategory,
          mode: cleanMode,

          rank: Number(item.rank),

          rating: 0,

          totalPoints: Number(
            item.points
          ),

          totalRounds: Number(
            item.totalRounds
          ),

          tieBreaker: Number(
            item.tieBreaker
          ),

          tournamentId: null,
          month: null,
          year: null,
        })
      );

      await tx.playerRanking.createMany({
        data,
      });
    }
  );

  return {
    category: cleanCategory,
    mode: cleanMode,
    standings,
  };
}

async function calculatePlayerTournamentStandings(
  tournamentId
) {
  const tournament =
    await getTournament(
      tournamentId
    );

  const players =
    await prisma.tournamentPlayer.findMany({
      where: {
        tournamentId: tournament.id,
      },

      select: {
        playerId: true,

        player: {
          select: {
            id: true,
            username: true,
            fullName: true,
            category: true,
            status: true,
          },
        },
      },
    });

  const results =
    await prisma.gameResult.findMany({
      where: {
        approvalStatus: APPROVED,

        pairing: {
          tournamentId:
            tournament.id,
        },
      },

      select: {
        id: true,
        round: true,
        mode: true,

        whitePlayerId: true,
        blackPlayerId: true,

        whiteScore: true,
        blackScore: true,

        date: true,
        pairingId: true,
      },

      orderBy: [
        { date: "asc" },
        { id: "asc" },
      ],
    });

  const standingsMap = new Map();

  for (const entry of players) {
    standingsMap.set(
      entry.playerId,
      {
        playerId: entry.playerId,
        username:
          entry.player.username,
        fullName:
          entry.player.fullName,
        category:
          entry.player.category,
        status:
          entry.player.status,

        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        totalRounds: 0,

        tieBreaker: 0,

        lastResultDate: null,
        lastResultId: null,
      }
    );
  }

  for (const result of results) {
    const white =
      standingsMap.get(
        result.whitePlayerId
      );

    const black =
      standingsMap.get(
        result.blackPlayerId
      );

    if (!white && !black) {
      continue;
    }

    if (white) {
      const outcome =
        getGameOutcome(
          result.whiteScore,
          result.blackScore
        );

      white.points += getPlayerPoints(
        result.whiteScore,
        result.blackScore,
        "SPECIAL"
      );

      black.points += getPlayerPoints(
        result.blackScore,
        result.whiteScore,
        "SPECIAL"
      );

      white.totalRounds += 1;

      if (outcome === "WIN") {
        white.wins += 1;
      } else if (outcome === "DRAW") {
        white.draws += 1;
      } else {
        white.losses += 1;
      }

      white.tieBreaker =
        getTieBreakerValue(outcome);

      white.lastResultDate = result.date;
      white.lastResultId = result.id;
    }

    if (black) {
      const outcome =
        getGameOutcome(
          result.blackScore,
          result.whiteScore
        );

      black.points += getPlayerPoints(
        result.blackScore,
        result.whiteScore,
        "SPECIAL"
      );

      black.totalRounds += 1;

      if (outcome === "WIN") {
        black.wins += 1;
      } else if (outcome === "DRAW") {
        black.draws += 1;
      } else {
        black.losses += 1;
      }

      black.tieBreaker =
        getTieBreakerValue(outcome);

      black.lastResultDate = result.date;
      black.lastResultId = result.id;
    }
  }

  const standings =
    Array.from(
      standingsMap.values()
    );

  sortPlayerStandings(standings);

  return {
    tournament,
    standings,
  };
}

async function savePlayerTournamentStandings(
  tournamentId
) {
  const id =
    validateTournamentId(
      tournamentId
    );

  const {
    tournament,
    standings,
  } =
    await calculatePlayerTournamentStandings(
      id
    );

  await prisma.$transaction(
    async (tx) => {
      await tx.tournamentResult.deleteMany({
        where: {
          tournamentId: id,
        },
      });

      if (standings.length === 0) {
        return;
      }

      const data =
        standings.map((item) => ({
          tournamentId: Number(id),

          playerId: Number(
            item.playerId
          ),

          rank: Number(item.rank),

          totalPoints: Number(
            item.points
          ),

          totalRounds: Number(
            item.totalRounds
          ),

          wins: Number(item.wins),
          draws: Number(item.draws),
          losses: Number(item.losses),

          ratingBefore: 0,
          ratingAfter: 0,

          tieBreaker: Number(
            item.tieBreaker
          ),
        }));

      await tx.tournamentResult.createMany({
        data,
      });
    }
  );

  return {
    tournament,
    standings,
  };
}

function calculateTeamMatchOutcome(
  teamPairing,
  approvedGames
) {
  let teamAScore = 0;
  let teamBScore = 0;

  for (const game of approvedGames) {
    if (game.result === null) {
      continue;
    }
    
    const result = Number(
      game.result
    );
    
    if (
      !Number.isFinite(result)
    ) {
      continue;
    }

    const whiteTeamId =
      game.whitePlayer?.teamId;

    const blackTeamId =
      game.blackPlayer?.teamId;

    if (
      whiteTeamId ===
      teamPairing.teamAId
    ) {
      teamAScore += result;
    } else if (
      whiteTeamId ===
      teamPairing.teamBId
    ) {
      teamBScore += result;
    }

    const blackScore =
      2 - result;

    if (
      blackTeamId ===
      teamPairing.teamAId
    ) {
      teamAScore += blackScore;
    } else if (
      blackTeamId ===
      teamPairing.teamBId
    ) {
      teamBScore += blackScore;
    }
  }

  let outcome;

  if (teamAScore > teamBScore) {
    outcome = "TEAM_A_WIN";
  } else if (
    teamAScore < teamBScore
  ) {
    outcome = "TEAM_B_WIN";
  } else {
    outcome = "DRAW";
  }

  return {
    teamAScore,
    teamBScore,
    outcome,
  };
}

async function calculateTeamStandings(
  mode
) {
  const cleanMode =
    validateMode(mode);

  const teamPairings =
    await prisma.teamPairing.findMany({
      where: {
        mode: cleanMode,
      },

      select: {
        id: true,
        round: true,

        teamAId: true,
        teamBId: true,

        teamA: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },

        teamB: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },

        games: {
          where: {
            approvalStatus: APPROVED,
          },

          select: {
            id: true,
            result: true,

            whitePlayerId: true,
            blackPlayerId: true,

            whitePlayer: {
              select: {
                id: true,
                teamId: true,
              },
            },

            blackPlayer: {
              select: {
                id: true,
                teamId: true,
              },
            },
          },
        },
      },

      orderBy: [
        { round: "asc" },
        { id: "asc" },
      ],
    });

  const standingsMap = new Map();

  for (const pairing of teamPairings) {
    if (
      pairing.teamA &&
      !standingsMap.has(
        pairing.teamAId
      )
    ) {
      standingsMap.set(
        pairing.teamAId,
        {
          teamId: pairing.teamAId,

          name: pairing.teamA.name,

          description:
            pairing.teamA.description,

          points: 0,
          totalRounds: 0,

          wins: 0,
          draws: 0,
          losses: 0,

          tieBreaker: 0,

          lastResultRound: -1,
          lastResultId: null,
        }
      );
    }

    if (
      pairing.teamB &&
      !standingsMap.has(
        pairing.teamBId
      )
    ) {
      standingsMap.set(
        pairing.teamBId,
        {
          teamId: pairing.teamBId,

          name: pairing.teamB.name,

          description:
            pairing.teamB.description,

          points: 0,
          totalRounds: 0,

          wins: 0,
          draws: 0,
          losses: 0,

          tieBreaker: 0,

          lastResultRound: -1,
          lastResultId: null,
        }
      );
    }
  }

  for (const pairing of teamPairings) {
    // A team match with no approved board games does not count.
    if (pairing.games.length === 0) {
      continue;
    }

    const match =
      calculateTeamMatchOutcome(
        pairing,
        pairing.games
      );

    const teamA =
      standingsMap.get(
        pairing.teamAId
      );

    const teamB =
      standingsMap.get(
        pairing.teamBId
      );

    if (!teamA || !teamB) {
      continue;
    }

    teamA.totalRounds += 1;
    teamB.totalRounds += 1;

    if (
      match.outcome ===
      "TEAM_A_WIN"
    ) {
      teamA.points += match.teamAScore;
      teamB.points += match.teamBScore;

      teamA.wins += 1;
      teamA.tieBreaker = 2;

      teamB.losses += 1;
      teamB.tieBreaker = 0;
    }

    else if (
      match.outcome ===
      "TEAM_B_WIN"
    ) {
      teamA.points += match.teamAScore;
      teamB.points += match.teamBScore;

      teamB.wins += 1;
      teamB.tieBreaker = 2;

      teamA.losses += 1;
      teamA.tieBreaker = 0;
    }

    else {
      teamA.points += match.teamAScore;
      teamB.points += match.teamBScore;

      teamA.draws += 1;
      teamB.draws += 1;

      teamA.tieBreaker = 1;
      teamB.tieBreaker = 1;
    }

    teamA.lastResultRound =
      pairing.round;

    teamB.lastResultRound =
      pairing.round;

    teamA.lastResultId =
      pairing.id;

    teamB.lastResultId =
      pairing.id;
  }

  const standings =
    Array.from(
      standingsMap.values()
    );

  sortTeamStandings(standings);

  return {
    mode: cleanMode,
    standings,
  };
}

async function saveTeamStandings(mode) {
  const cleanMode =
    validateMode(mode);

  const {
    standings,
  } =
    await calculateTeamStandings(
      cleanMode
    );

  await prisma.$transaction(
    async (tx) => {

      await tx.teamRanking.deleteMany({
        where: {
          tournamentId: null,
          mode: cleanMode,
        },
      });

      if (standings.length === 0) {
        return;
      }

      const data =
        standings.map((item) => ({
          teamId: Number(
            item.teamId
          ),

          category: null,
          mode: cleanMode,

          rank: Number(item.rank),

          totalPoints: Number(
            item.points
          ),

          totalRating: 0,

          totalRounds: Number(
            item.totalRounds
          ),

          wins: Number(item.wins),
          draws: Number(item.draws),
          losses: Number(item.losses),

          tieBreaker: Number(
            item.tieBreaker
          ),

          tournamentId: null,

          month: null,
          year: null,
        }));

      await tx.teamRanking.createMany({
        data,
      });
    }
  );

  return {
    mode: cleanMode,
    standings,
  };
}

async function rebuildTournamentStandings(
  tournamentId
) {
  const tournament =
    await getTournament(
      tournamentId
    );

  return savePlayerTournamentStandings(
    tournament.id
  );
}

async function getTournamentStandings(
  tournamentId
) {
  const id =
    validateTournamentId(
      tournamentId
    );

  const tournament =
    await getTournament(id);

  return prisma.tournamentResult.findMany({
    where: {
      tournamentId:
        tournament.id,
    },

    include: {
      player: {
        select: {
          id: true,
          username: true,
          fullName: true,
          category: true,
          status: true,
        },
      },
    },

    orderBy: [
      { rank: "asc" },
      { playerId: "asc" },
    ],
  });
}

async function getCategoryStandings(
  category,
  mode
) {
  const cleanCategory =
    validateCategory(category);

  const cleanMode =
    validateMode(mode);

  return prisma.playerRanking.findMany({
    where: {
      category: cleanCategory,
      mode: cleanMode,
      tournamentId: null,
    },

    include: {
      player: {
        select: {
          id: true,
          username: true,
          fullName: true,
          category: true,
          status: true,
        },
      },
    },

    orderBy: [
      { rank: "asc" },
      { playerId: "asc" },
    ],
  });
}

async function getTeamStandings(mode) {
  const cleanMode =
    validateMode(mode);

  return prisma.teamRanking.findMany({
    where: {
      mode: cleanMode,
      tournamentId: null,
    },

    include: {
      team: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },

    orderBy: [
      { rank: "asc" },
      { teamId: "asc" },
    ],
  });
}

async function getTeamTournamentStandings(
  tournamentId
) {
  const id =
    validateTournamentId(
      tournamentId
    );

  throw new Error(
    `Team standings are independent of Tournament. Tournament ${id} cannot be used for team standings.`
  );
}

async function calculateTournamentStandings(
  tournamentId
) {
  const tournament =
    await getTournament(
      tournamentId
    );

  return calculatePlayerTournamentStandings(
    tournament.id
  );
}

async function rebuildAllStandings() {
  const results = [];

  const categoryPairs =
    await prisma.pairing.findMany({
      where: {
        tournamentId: null,
      },

      select: {
        category: true,
        mode: true,
      },

      distinct: [
        "category",
        "mode",
      ],

      orderBy: [
        { category: "asc" },
        { mode: "asc" },
      ],
    });

  for (const pair of categoryPairs) {
    try {
      const result =
        await saveCategoryStandings(
          pair.category,
          pair.mode
        );

      results.push({
        system: "CATEGORY",

        category:
          pair.category,

        mode: pair.mode,

        standingsCount:
          result.standings.length,

        success: true,
      });
    } catch (error) {
      results.push({
        system: "CATEGORY",

        category:
          pair.category,

        mode: pair.mode,

        standingsCount: 0,

        success: false,

        error: error.message,
      });
    }
  }

  const tournaments =
    await prisma.tournament.findMany({
      where: {
        type: "SPECIAL",
      },

      select: {
        id: true,
        name: true,
        type: true,
        status: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  for (const tournament of tournaments) {
    try {
      const result =
        await savePlayerTournamentStandings(
          tournament.id
        );

      results.push({
        system: "SPECIAL",

        tournamentId:
          tournament.id,

        name:
          tournament.name,

        type:
          tournament.type,

        status:
          tournament.status,

        standingsCount:
          result.standings.length,

        success: true,
      });
    } catch (error) {
      results.push({
        system: "SPECIAL",

        tournamentId:
          tournament.id,

        name:
          tournament.name,

        type:
          tournament.type,

        status:
          tournament.status,

        standingsCount: 0,

        success: false,

        error: error.message,
      });
    }
  }

  const teamModes =
    await prisma.teamPairing.findMany({
      select: {
        mode: true,
      },

      distinct: ["mode"],

      orderBy: {
        mode: "asc",
      },
    });

  for (const entry of teamModes) {
    try {
      const result =
        await saveTeamStandings(
          entry.mode
        );

      results.push({
        system: "TEAM",

        mode: entry.mode,

        standingsCount:
          result.standings.length,

        success: true,
      });
    } catch (error) {
      results.push({
        system: "TEAM",

        mode: entry.mode,

        standingsCount: 0,

        success: false,

        error: error.message,
      });
    }
  }

  return results;
}


async function rebuildAllTournamentStandings() {
  return rebuildAllStandings();
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Category
  calculateCategoryStandings,
  saveCategoryStandings,
  getCategoryStandings,

  // Special events
  calculatePlayerTournamentStandings,
  savePlayerTournamentStandings,
  calculateTournamentStandings,
  rebuildTournamentStandings,
  getTournamentStandings,

  // Team
  calculateTeamStandings,
  saveTeamStandings,
  getTeamStandings,
  getTeamTournamentStandings,

  // Rebuild everything
  rebuildAllStandings,
  rebuildAllTournamentStandings,

  // Helpers
  getGameOutcome,
  getTieBreakerValue,
  getPlayerPoints,
};
