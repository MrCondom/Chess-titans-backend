const prisma = require("../lib/prisma");
const { calculateAccuracy } = require("../utils/accuracyCalculator");
const notificationService = require("./notificationService");



async function recordTournamentTable(tournamentId) {
  tournamentId = Number(tournamentId);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error("Invalid tournament ID.");
  }

  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId,
    },

    include: {
      players: {
        select: {
          playerId: true,
          player: {
            select: {
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
        },
      },
    },
  });

  if (!tournament) {
    const error = new Error("Tournament not found.");
    error.code = "TOURNAMENT_NOT_FOUND";
    throw error;
  }

  // Get the final round pairings
  const finalRoundPairings = await prisma.pairing.findMany({
    where: {
      tournamentId,
      round: tournament.totalRounds,
    },

    select: {
      id: true,
    },
  });

  if (!finalRoundPairings.length) {
    const error = new Error(
      "Final round pairings have not been created."
    );
    error.code = "FINAL_ROUND_NOT_CREATED";
    throw error;
  }

  // Every final-round pairing must have a result
  const completedFinalRound = await prisma.gameResult.count({
    where: {
      pairingId: {
        in: finalRoundPairings.map((pairing) => pairing.id),
      },
      approvalStatus: "APPROVED",
    },
  });

  if (completedFinalRound !== finalRoundPairings.length) {
    const error = new Error(
      "The final round is not completely recorded."
    );
    error.code = "FINAL_ROUND_INCOMPLETE";
    throw error;
  }

  // Get all tournament results
  const results = await prisma.gameResult.findMany({
    where: {
      pairing: {
        tournamentId,
      },
      approvalStatus: "APPROVED",
    },
  
    select: {
      whitePlayerId: true,
      blackPlayerId: true,
      whiteScore: true,
      blackScore: true,
    },
  });

  const table = new Map();

  // Include all registered players
  for (const participant of tournament.players) {
    table.set(participant.playerId, {
      playerId: participant.playerId,
      totalRounds: 0,
      totalPoints: 0,
      accuracy: 0,
      rating:
        tournament.mode === "RAPID"
          ? participant.player.rapidRating
          : tournament.mode === "BLITZ"
            ? participant.player.blitzRating
            : participant.player.bulletRating,
    });
  }

  // Calculate points
  for (const result of results) {
    const white = table.get(result.whitePlayerId);
    const black = table.get(result.blackPlayerId);

    if (white) {
      white.totalRounds += 1;
      white.totalPoints += Number(result.whiteScore);
    }

    if (black) {
      black.totalRounds += 1;
      black.totalPoints += Number(result.blackScore);
    }
  }

  // Accuracy = percentage of possible points achieved
  for (const player of table.values()) {
    player.accuracy = calculateAccuracy(
      player.totalPoints,
      player.totalRounds,
      player.rating
    );
  }

  // Sort standings
  const standings = [...table.values()]
    .sort((a, b) => {
      return (
        b.totalPoints - a.totalPoints ||
        b.accuracy - a.accuracy ||
        a.playerId - b.playerId
      );
    })
    .map((player, index) => ({
      playerId: player.playerId,
      totalRounds: player.totalRounds,
      totalPoints: player.totalPoints,
      accuracy: player.accuracy,
      rank: index + 1,
    }));

  // Save tournament table
  await prisma.$transaction(
    async (tx) => {
      for (const player of standings) {
        await tx.tournamentResult.upsert({
          where: {
            tournamentId_playerId: {
              tournamentId,
              playerId: player.playerId,
            },
          },

          create: {
            tournamentId,
            playerId: player.playerId,
            rank: player.rank,
            totalPoints: player.totalPoints,
            totalRounds: player.totalRounds,
            accuracy: player.accuracy,
          },

          update: {
            rank: player.rank,
            totalPoints: player.totalPoints,
            totalRounds: player.totalRounds,
            accuracy: player.accuracy,
          },
        });
      }
    }
  );

  return standings;
}


async function declareTournamentWinner(tournamentId) {
  tournamentId = Number(tournamentId);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    throw new Error("Invalid tournament ID.");
  }

  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId,
    },

    include: {
      players: {
        select: {
          playerId: true,
        },
      },
    },
  });

  if (!tournament) {
    const error = new Error("Tournament not found.");
    error.code = "TOURNAMENT_NOT_FOUND";
    throw error;
  }

  // Check final round pairings
  const finalRoundPairings =
    await prisma.pairing.findMany({
      where: {
        tournamentId,
        round: tournament.totalRounds,
      },

      select: {
        id: true,
      },
    });

  if (!finalRoundPairings.length) {
    const error = new Error(
      "Final round pairings have not been created."
    );

    error.code = "FINAL_ROUND_NOT_CREATED";
    throw error;
  }

  // Make sure every final-round pairing has a result
  const completedFinalRound = await prisma.gameResult.count({
    where: {
      pairingId: {
        in: finalRoundPairings.map((pairing) => pairing.id),
      },
      approvalStatus: "APPROVED",
    },
  });
  
  if (
    completedFinalRound !==
    finalRoundPairings.length
  ) {
    const error = new Error(
      "Cannot declare winner. The final round is not completely recorded."
    );

    error.code = "FINAL_ROUND_INCOMPLETE";
    throw error;
  }

  // Get the recorded tournament table
  const standings =
    await prisma.tournamentResult.findMany({
      where: {
        tournamentId,
      },

      orderBy: {
        rank: "asc",
      },

      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },
    });

  if (!standings.length) {
    const error = new Error(
      "Tournament table has not been recorded."
    );

    error.code = "TOURNAMENT_TABLE_NOT_RECORDED";
    throw error;
  }

  const winner = standings[0];

  const championTitle =
    tournament.type === "SPECIAL"
      ? "Special Champion"
      : tournament.type === "CATEGORY"
        ? "Category Champion"
        : "Team Champion";

  const completedTournament =
    await prisma.tournament.update({
      where: {
        id: tournamentId,
      },

      data: {
        status: "COMPLETED",
        championPlayerId: winner.playerId,
        championUsername: winner.player.username,
        championTitle,
        completedAt: new Date(),
      },
    });

  // Notify all tournament players
  try {
    await Promise.all(
      tournament.players.map((participant) =>
        notificationService.createNotification({
          playerId: participant.playerId,
          type: "CHAMPIONSHIP",
          title:
            participant.playerId === winner.playerId
              ? "Tournament Champion"
              : "Tournament Completed",
          message:
            participant.playerId === winner.playerId
              ? `Congratulations! You won "${tournament.name}".`
              : `"${tournament.name}" has been completed. The champion is ${winner.player.username}.`,
        })
      )
    );
  } catch (error) {
    console.error(
      "TOURNAMENT WINNER NOTIFICATION ERROR:",
      error
    );
  }

  return {
    tournament: completedTournament,

    champion: {
      playerId: winner.playerId,
      username: winner.player.username,
      fullName: winner.player.fullName,
      rank: winner.rank,
      totalPoints: winner.totalPoints,
      totalRounds: winner.totalRounds,
      accuracy: winner.accuracy,
    },

    standings,
  };
}

async function recordTeamTournamentTable(tournamentId) {
  tournamentId = Number(tournamentId);

  if (!Number.isInteger(tournamentId) || tournamentId <= 0) {
    const error = new Error("Invalid tournament ID.");
    error.code = "INVALID_TOURNAMENT_ID";
    throw error;
  }

  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId,
    },

    select: {
      id: true,
      name: true,
      type: true,
      format: true,
      mode: true,
      totalRounds: true,
      status: true,
    },
  });

  if (!tournament) {
    const error = new Error("Tournament not found.");
    error.code = "TOURNAMENT_NOT_FOUND";
    throw error;
  }

  if (tournament.type !== "TEAM") {
    const error = new Error(
      "This function can only record team tournaments."
    );
    error.code = "NOT_TEAM_TOURNAMENT";
    throw error;
  }

  if (tournament.format !== "TEAM_BOARD") {
    const error = new Error(
      "This tournament is not a team-board tournament."
    );
    error.code = "INVALID_TEAM_TOURNAMENT_FORMAT";
    throw error;
  }

  if (!tournament.totalRounds || tournament.totalRounds < 1) {
    const error = new Error(
      "Tournament has an invalid number of rounds."
    );
    error.code = "INVALID_TOTAL_ROUNDS";
    throw error;
  }

  const teamPairings = await prisma.teamPairing.findMany({
    where: {
      tournamentId,
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
        },
      },

      teamB: {
        select: {
          id: true,
          name: true,
        },
      },

      games: {
        select: {
          id: true,
          boardPosition: true,
          whitePlayerId: true,
          blackPlayerId: true,
          result: true,
          approvalStatus: true,

          whitePlayer: {
            select: {
              id: true,
              teamId: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
          
          blackPlayer: {
            select: {
              id: true,
              teamId: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
        },
      },
    },

    orderBy: {
      round: "asc",
    },
  });

  if (!teamPairings.length) {
    const error = new Error(
      "No team pairings have been created for this tournament."
    );
    error.code = "TEAM_PAIRINGS_NOT_CREATED";
    throw error;
  }

  for (const pairing of teamPairings) {
    if (!pairing.teamA || !pairing.teamB) {
      const error = new Error(
        `Team pairing ${pairing.id} contains a missing team.`
      );

      error.code = "TEAM_NOT_FOUND";

      throw error;
    }

    if (pairing.teamAId === pairing.teamBId) {
      const error = new Error(
        `Team pairing ${pairing.id} contains the same team on both sides.`
      );

      error.code = "INVALID_TEAM_PAIRING";

      throw error;
    }
  }

  const finalRoundPairings = teamPairings.filter(
    (pairing) => pairing.round === tournament.totalRounds
  );

  if (!finalRoundPairings.length) {
    const error = new Error(
      "Final round team pairings have not been created."
    );

    error.code = "FINAL_ROUND_NOT_CREATED";

    throw error;
  }

  for (const pairing of finalRoundPairings) {
    if (!pairing.games.length) {
      const error = new Error(
        `No games have been recorded for ${pairing.teamA.name} vs ${pairing.teamB.name} in the final round.`
      );

      error.code = "TEAM_GAMES_NOT_FOUND";

      throw error;
    }

    for (const game of pairing.games) {
      if (
        ![1, 0, -1].includes(Number(game.result)) ||
        game.approvalStatus !== "APPROVED"
      ) {
        const error = new Error(
          `The final round contains an incomplete result for ${pairing.teamA.name} vs ${pairing.teamB.name}.`
        );

        error.code = "FINAL_ROUND_INCOMPLETE";

        throw error;
      }
    }
  }


  for (const pairing of teamPairings) {
    if (!pairing.games.length) {
      const error = new Error(
        `No games found for ${pairing.teamA.name} vs ${pairing.teamB.name} in round ${pairing.round}.`
      );

      error.code = "TEAM_GAMES_NOT_FOUND";

      throw error;
    }

    for (const game of pairing.games) {
      if (
            ![1, 0, -1].includes(Number(game.result)) ||
            game.approvalStatus !== "APPROVED"
          ) {
        const error = new Error(
          `Round ${pairing.round} is not completely recorded for ${pairing.teamA.name} vs ${pairing.teamB.name}.`
        );

        error.code = "TOURNAMENT_INCOMPLETE";

        throw error;
      }
    }
  }

  const table = new Map();

  function addTeam(team) {
    if (!team) {
      return;
    }

    if (!table.has(team.id)) {
      table.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        totalPoints: 0,
        totalRating: 0,
        playingPlayerIds: new Set(),
      });
    }
  }

  for (const pairing of teamPairings) {
    addTeam(pairing.teamA);
    addTeam(pairing.teamB);
  }


  for (const pairing of teamPairings) {
    const teamA = table.get(pairing.teamAId);
    const teamB = table.get(pairing.teamBId);

    if (!teamA || !teamB) {
      const error = new Error(
        `Invalid team pairing ${pairing.id}.`
      );

      error.code = "INVALID_TEAM_PAIRING";

      throw error;
    }

    for (const game of pairing.games) {
      const result = Number(game.result);


      if (result === 1) {
        teamA.totalPoints += 1;
      } else if (result === -1) {
        teamB.totalPoints += 1;
      } else if (result === 0) {
        teamA.totalPoints += 0.5;
        teamB.totalPoints += 0.5;
      }

      if (game.whitePlayer?.id) {
        if (game.whitePlayer.teamId === teamA.teamId) {
          teamA.playingPlayerIds.add(game.whitePlayer.id);
        } else if (game.whitePlayer.teamId === teamB.teamId) {
          teamB.playingPlayerIds.add(game.whitePlayer.id);
        }
      }
      
      if (game.blackPlayer?.id) {
        if (game.blackPlayer.teamId === teamA.teamId) {
          teamA.playingPlayerIds.add(game.blackPlayer.id);
        } else if (game.blackPlayer.teamId === teamB.teamId) {
          teamB.playingPlayerIds.add(game.blackPlayer.id);
        }
      }
    }
  }

  const teamIds = [...table.keys()];

  const teams = await prisma.team.findMany({
    where: {
      id: {
        in: teamIds,
      },
    },

    select: {
      id: true,

      players: {
        select: {
          id: true,
          rapidRating: true,
          blitzRating: true,
          bulletRating: true,
        },
      },
    },
  });

  const teamMap = new Map(
    teams.map((team) => [team.id, team])
  );

  for (const team of table.values()) {
    const dbTeam = teamMap.get(team.teamId);

    if (!dbTeam) {
      const error = new Error(
        `Team ${team.teamId} no longer exists.`
      );

      error.code = "TEAM_NOT_FOUND";

      throw error;
    }

    team.totalRating = [...team.playingPlayerIds].reduce(
      (total, playerId) => {
        const player = dbTeam.players.find(
          (p) => p.id === playerId
        );
    
        if (!player) {
          return total;
        }
    
        let rating = 0;
    
        if (tournament.mode === "RAPID") {
          rating = player.rapidRating;
        } else if (tournament.mode === "BLITZ") {
          rating = player.blitzRating;
        } else if (tournament.mode === "BULLET") {
          rating = player.bulletRating;
        }
    
        return total + Number(rating || 0);
      },
      0
    );
    
    delete team.playingPlayerIds;
  }

  const standings = [...table.values()]
    .sort((a, b) => {
      return (
        b.totalPoints - a.totalPoints ||
        b.totalRating - a.totalRating ||
        a.teamId - b.teamId
      );
    })
    .map((team, index) => ({
      teamId: team.teamId,
      teamName: team.teamName,
      totalRating: team.totalRating,
      totalPoints: team.totalPoints,
      rank: index + 1,
    }));

  await prisma.$transaction(async (tx) => {
    for (const team of standings) {
      await tx.teamRanking.upsert({
        where: {
          tournamentId_teamId: {
            tournamentId,
            teamId: team.teamId,
          },
        },

        create: {
          tournamentId,
          teamId: team.teamId,
          rank: team.rank,
          totalPoints: team.totalPoints,
          totalRating: team.totalRating,
          mode: tournament.mode,
          category: null,
        },

        update: {
          rank: team.rank,
          totalPoints: team.totalPoints,
          totalRating: team.totalRating,
          mode: tournament.mode,
          category: null,
        },
      });
    }
  });

  return standings;
}



module.exports = {
  recordTournamentTable,
  declareTournamentWinner,
  recordTeamTournamentTable
};


