const prisma = require("../lib/prisma");



function validateId(value, name) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${name}.`);
  }

  return id;
}



function validateRound(value) {
  const round = Number(value);

  if (!Number.isInteger(round) || round <= 0) {
    throw new Error("Invalid round.");
  }

  return round;
}

function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
}


async function generatePairings({
  tournamentId,
  round,
  availableAt,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round = validateRound(round);

  
  const pairingTime = availableAt
    ? new Date(availableAt)
    : new Date();
  
  if (isNaN(pairingTime.getTime())) {
    throw new Error("Invalid availableAt.");
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
    throw new Error("Tournament not found.");
  }

  if (
    tournament.format === "TEAM_BOARD"
  ) {
    throw new Error(
      "Team tournaments require team pairing generation."
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

  const totalRounds =
    tournament.format === "ROUND_ROBIN"
      ? players.length % 2 === 0
        ? players.length - 1
        : players.length
      : tournament.totalRounds;

  if (round > totalRounds) {
    throw new Error(
      `Round ${round} is invalid. This tournament has ${totalRounds} rounds.`
    );
  }

  const existing =
    await prisma.pairing.count({
      where: {
        tournamentId,
        round,
      },
    });

  if (existing > 0) {
    throw new Error(
      `Pairings for round ${round} already exist.`
    );
  }

  let orderedPlayers;

  if (tournament.format === "ROUND_ROBIN") {
    orderedPlayers = [
      ...players,
    ];

    if (orderedPlayers.length % 2 !== 0) {
      orderedPlayers.push(null);
    }

    const fixed = orderedPlayers[0];

    let rotating =
      orderedPlayers.slice(1);

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

    orderedPlayers = [
      fixed,
      ...rotating,
    ];
  }

  else if (tournament.format === "SWISS") {
    orderedPlayers = shuffle(players);
  }
  
  else {
    throw new Error(
      "Invalid tournament format."
    );
  }

  const pairings = [];

  for (
    let i = 0;
    i < orderedPlayers.length;
    i += 2
  ) {
    const playerA =
      orderedPlayers[i];

    const playerB =
      orderedPlayers[i + 1];

    if (!playerA || !playerB) {
      continue;
    }

    pairings.push({
      tournamentId,

      category:
        tournament.category || "",

      round,

      mode: tournament.mode,

      whitePlayerId: playerA.id,

      blackPlayerId: playerB.id,

      availableAt: pairingTime,
    });
  }

  if (pairings.length === 0) {
    throw new Error(
      "No pairings could be generated."
    );
  }

  const created =
    await prisma.pairing.createMany({
      data: pairings,
    });

  return {
    tournamentId,
    round,
    format: tournament.format,
    mode: tournament.mode,
    totalRounds,
    count: created.count,
  };
}


async function generateTeamPairings({
  tournamentId,
  round,
  availableAt,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round = validateRound(round);

  
  const pairingTime = availableAt
    ? new Date(availableAt)
    : new Date();
  
  if (isNaN(pairingTime.getTime())) {
    throw new Error("Invalid availableAt.");
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
                teamId: true,
                status: true,
              },
            },
          },
        },
      },
    });

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  if (tournament.type !== "TEAM") {
    throw new Error(
      "Team pairings can only be generated for TEAM tournaments."
    );
  }

  if (tournament.status !== "ACTIVE") {
    throw new Error(
      "Tournament must be ACTIVE."
    );
  }

  const teamIds = [
    ...new Set(
      tournament.players
        .map((entry) => entry.player)
        .filter(
          (player) =>
            player.status === "ACTIVE" &&
            player.teamId !== null
        )
        .map((player) => player.teamId)
    ),
  ];

  if (teamIds.length < 2) {
    throw new Error(
      "At least two teams are required."
    );
  }

  const teams =
    await prisma.team.findMany({
      where: {
        id: {
          in: teamIds,
        },
      },

      select: {
        id: true,
        name: true,
      },

      orderBy: {
        id: "asc",
      },
    });

  if (teams.length < 2) {
    throw new Error(
      "At least two teams are required."
    );
  }

  const existing =
    await prisma.teamPairing.count({
      where: {
        tournamentId,
        round,
      },
    });

  if (existing > 0) {
    throw new Error(
      `Team pairings for round ${round} already exist.`
    );
  }

  let orderedTeams = [...teams];

  const totalRounds =
    tournament.format === "ROUND_ROBIN"
      ? teams.length % 2 === 0
        ? teams.length - 1
        : teams.length
      : tournament.totalRounds;

  if (round > totalRounds) {
    throw new Error(
      `Round ${round} is invalid. Maximum round is ${totalRounds}.`
    );
  }

  if (
    tournament.format === "ROUND_ROBIN"
  ) {
    if (orderedTeams.length % 2 !== 0) {
      orderedTeams.push(null);
    }

    const fixed = orderedTeams[0];

    let rotating =
      orderedTeams.slice(1);

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

    orderedTeams = [
      fixed,
      ...rotating,
    ];
  }

  else if (
    tournament.format === "SWISS"
  ) {
    orderedTeams = shuffle(
      orderedTeams
    );
  }

  else {
    throw new Error(
      "Invalid tournament format for team pairings."
    );
  }

  const pairings = [];

  for (
    let i = 0;
    i < orderedTeams.length;
    i += 2
  ) {
    const teamA =
      orderedTeams[i];

    const teamB =
      orderedTeams[i + 1];

    // Bye
    if (!teamA || !teamB) {
      continue;
    }


    pairings.push({
      tournamentId,
      round,

      teamAId: teamA.id,
      teamBId: teamB.id,

      availableAt:pairingTime,
    });
  }

  if (pairings.length === 0) {
    throw new Error(
      "No team pairings could be generated."
    );
  }

  const created =
    await prisma.teamPairing.createMany({
      data: pairings,
    });

  return {
    tournamentId,
    round,
    format: tournament.format,
    totalRounds,
    count: created.count,
    pairings,
  };
}

async function deletePairings({
  tournamentId,
  round,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round = validateRound(round);

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      select: {
        id: true,
      },
    });

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const pairings =
    await prisma.pairing.findMany({
      where: {
        tournamentId,
        round,
      },

      select: {
        id: true,
      },
    });

  if (pairings.length === 0) {
    throw new Error(
      `No pairings found for round ${round}.`
    );
  }

  const pairingIds =
    pairings.map(
      (pairing) => pairing.id
    );

  const result =
    await prisma.gameResult.findFirst({
      where: {
        pairingId: {
          in: pairingIds,
        },
      },

      select: {
        id: true,
      },
    });

  if (result) {
    throw new Error(
      `Pairings for round ${round} cannot be deleted because a game result has already been recorded.`
    );
  }

  const deleted =
    await prisma.pairing.deleteMany({
      where: {
        tournamentId,
        round,
      },
    });

  return {
    tournamentId,
    round,
    deleted: deleted.count,
  };
}

async function generateTeamTablePairings({
  teamPairingId,
}) {
  teamPairingId = validateId(
    teamPairingId,
    "team pairing ID"
  );

  const teamPairing =
    await prisma.teamPairing.findUnique({
      where: {
        id: teamPairingId,
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
                player: true,
              },
              orderBy: {
                boardPosition: "asc",
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
                player: true,
              },
              orderBy: {
                boardPosition: "asc",
              },
            },
          },
        },
      },
    });

  if (!teamPairing) {
    throw new Error("Team pairing not found.");
  }

  const teamAPlayers =
    teamPairing.teamA.memberships;

  const teamBPlayers =
    teamPairing.teamB.memberships;

  if (
    teamAPlayers.length === 0 ||
    teamBPlayers.length === 0
  ) {
    throw new Error(
      "Both teams must have active players with board positions."
    );
  }

  const teamBByBoard =
    new Map(
      teamBPlayers.map((membership) => [
        membership.boardPosition,
        membership.player,
      ])
    );

  const games = [];

  for (const membership of teamAPlayers) {
    const playerB =
      teamBByBoard.get(
        membership.boardPosition
      );

    if (!playerB) {
      continue;
    }

    games.push({
      teamPairingId,

      boardPosition:
        membership.boardPosition,

      whitePlayerId:
        membership.player.id,

      blackPlayerId:
        playerB.id,

      result: 0,
    });
  }

  if (games.length === 0) {
    throw new Error(
      "No matching board positions found between the teams."
    );
  }

  const existing =
    await prisma.teamGame.findMany({
      where: {
        teamPairingId,
      },

      select: {
        boardPosition: true,
      },
    });

  const existingBoards =
    new Set(
      existing.map(
        (game) => game.boardPosition
      )
    );

  const newGames =
    games.filter(
      (game) =>
        !existingBoards.has(
          game.boardPosition
        )
    );

  if (newGames.length === 0) {
    throw new Error(
      "Team table pairings already exist."
    );
  }

  const created =
    await prisma.teamGame.createMany({
      data: newGames,
    });

  return {
    teamPairingId,
    count: created.count,
  };
}

async function deleteTeamPairings({
  tournamentId,
  round,
}) {
  tournamentId = validateId(
    tournamentId,
    "tournament ID"
  );

  round = validateRound(round);

  const tournament =
    await prisma.tournament.findUnique({
      where: {
        id: tournamentId,
      },

      select: {
        id: true,
      },
    });

  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const teamPairings =
    await prisma.teamPairing.findMany({
      where: {
        tournamentId,
        round,
      },

      select: {
        id: true,
      },
    });

  if (teamPairings.length === 0) {
    throw new Error(
      `No team pairings found for round ${round}.`
    );
  }

  const teamPairingIds =
    teamPairings.map(
      (pairing) => pairing.id
    );

  const existingGames =
    await prisma.teamGame.findFirst({
      where: {
        teamPairingId: {
          in: teamPairingIds,
        },
      },

      select: {
        id: true,
      },
    });

  if (existingGames) {
    throw new Error(
      `Team pairings for round ${round} cannot be deleted because team table games already exist.`
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
    deleted: deleted.count,
  };
}

module.exports = {
  generatePairings,
  generateTeamPairings,
  deletePairings,
  generateTeamTablePairings,
  deleteTeamPairings,
};
