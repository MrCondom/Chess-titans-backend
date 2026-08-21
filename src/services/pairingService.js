const prisma = require("../lib/prisma");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];

function validateMode(mode) {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      "Invalid game mode. Use RAPID, BLITZ, or BULLET."
    );
  }
}

function validateId(value, name) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ${name}.`);
  }

  return id;
}

function validateRound(round) {
  const value = Number(round);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Invalid round.");
  }

  return value;
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
    players.length - 1;

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

  else {
    orderedPlayers = [
      ...players,
    ];

    for (
      let i = orderedPlayers.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(
          Math.random() * (i + 1)
        );

      [
        orderedPlayers[i],
        orderedPlayers[j],
      ] = [
        orderedPlayers[j],
        orderedPlayers[i],
      ];
    }
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

      availableAt:
        availableAt
          ? new Date(availableAt)
          : new Date(),
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


module.exports = {
  generatePairings,
};
