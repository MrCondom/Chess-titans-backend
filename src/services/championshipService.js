const prisma = require("../lib/prisma");
const {
  createNotification,
  createNotifications,
} = require("./notificationService");

const CHAMPIONSHIP_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

/**
 * Create a new bullet championship.
 */
async function createChampionship({ name }) {
  if (typeof name !== "string" || !name.trim()) {
    const error = new Error("Championship name is required");
    error.code = "INVALID_CHAMPIONSHIP_NAME";
    throw error;
  }

  const championship = await prisma.bulletChampionship.create({
    data: {
      name: name.trim(),
      status: CHAMPIONSHIP_STATUS.DRAFT,
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bulletRating: true,
              status: true,
            },
          },
        },
      },
    },
  });

  return championship;
}


/**
 * Get a championship by ID.
 */
async function getChampionship(championshipId) {
  const id = normalizeId(championshipId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id,
    },
    include: {
      championPlayer: {
        select: {
          id: true,
          fullName: true,
          username: true,
          bulletRating: true,
          currentChampionTitle: true,
        },
      },
      players: {
        orderBy: [
          {
            rank: "asc",
          },
          {
            totalPoints: "desc",
          },
          {
            totalRounds: "desc",
          },
        ],
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bulletRating: true,
              bulletGain: true,
              status: true,
              category: true,
            },
          },
        },
      },
    },
  });

  if (!championship) {
    const error = new Error("Championship not found");
    error.code = "CHAMPIONSHIP_NOT_FOUND";
    throw error;
  }

  return championship;
}


/**
 * List championships.
 */
async function getChampionships({
  page = 1,
  limit = 20,
  status = null,
} = {}) {
  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  if (limit > 100) {
    limit = 100;
  }

  const where = {};

  if (status) {
    if (!Object.values(CHAMPIONSHIP_STATUS).includes(status)) {
      const error = new Error("Invalid championship status");
      error.code = "INVALID_CHAMPIONSHIP_STATUS";
      throw error;
    }

    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [championships, total] = await prisma.$transaction([
    prisma.bulletChampionship.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        championPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
        _count: {
          select: {
            players: true,
          },
        },
      },
    }),

    prisma.bulletChampionship.count({
      where,
    }),
  ]);

  return {
    championships,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


/**
 * Add a player to a championship.
 */
async function addPlayer(championshipId, playerId) {
  const championshipIdValue = normalizeId(championshipId);
  const playerIdValue = normalizeId(playerId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id: championshipIdValue,
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (championship.status !== CHAMPIONSHIP_STATUS.DRAFT) {
    throwError(
      "Players can only be added while the championship is in DRAFT status",
      "CHAMPIONSHIP_NOT_DRAFT"
    );
  }

  const player = await prisma.player.findUnique({
    where: {
      id: playerIdValue,
    },
  });

  if (!player) {
    throwError(
      "Player not found",
      "PLAYER_NOT_FOUND"
    );
  }

  if (player.status !== "ACTIVE") {
    throwError(
      "Only active players can participate in a championship",
      "PLAYER_NOT_ACTIVE"
    );
  }

  const existing = await prisma.bulletChampionshipPlayer.findUnique({
    where: {
      championshipId_playerId: {
        championshipId: championshipIdValue,
        playerId: playerIdValue,
      },
    },
  });

  if (existing) {
    throwError(
      "Player is already registered for this championship",
      "PLAYER_ALREADY_REGISTERED"
    );
  }

  const participant =
    await prisma.bulletChampionshipPlayer.create({
      data: {
        championshipId: championshipIdValue,
        playerId: playerIdValue,
        totalPoints: 0,
        totalRounds: 0,
        accuracy: 0,
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
            bulletRating: true,
          },
        },
      },
    });

  return participant;
}


/**
 * Remove a player from a championship.
 */
async function removePlayer(championshipId, playerId) {
  const championshipIdValue = normalizeId(championshipId);
  const playerIdValue = normalizeId(playerId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id: championshipIdValue,
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (championship.status !== CHAMPIONSHIP_STATUS.DRAFT) {
    throwError(
      "Players can only be removed while the championship is in DRAFT status",
      "CHAMPIONSHIP_NOT_DRAFT"
    );
  }

  const participant =
    await prisma.bulletChampionshipPlayer.findUnique({
      where: {
        championshipId_playerId: {
          championshipId: championshipIdValue,
          playerId: playerIdValue,
        },
      },
    });

  if (!participant) {
    throwError(
      "Player is not registered for this championship",
      "PLAYER_NOT_REGISTERED"
    );
  }

  await prisma.bulletChampionshipPlayer.delete({
    where: {
      id: participant.id,
    },
  });

  return {
    success: true,
    message: "Player removed from championship",
  };
}


/**
 * Start a championship.
 */
async function startChampionship(championshipId) {
  const id = normalizeId(championshipId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id,
    },
    include: {
      players: true,
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (championship.status !== CHAMPIONSHIP_STATUS.DRAFT) {
    throwError(
      "Only a DRAFT championship can be started",
      "INVALID_CHAMPIONSHIP_STATE"
    );
  }

  if (championship.players.length < 2) {
    throwError(
      "At least two players are required to start a championship",
      "NOT_ENOUGH_PLAYERS"
    );
  }

  const startedAt = new Date();

  const updated = await prisma.bulletChampionship.update({
    where: {
      id,
    },
    data: {
      status: CHAMPIONSHIP_STATUS.ACTIVE,
      startedAt,
    },
    include: {
      players: {
        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bulletRating: true,
            },
          },
        },
      },
    },
  });

  await createNotifications(
    championship.players.map((participant) => participant.playerId),
    {
      type: "CHAMPIONSHIP",
      title: "Championship Started",
      message: `${championship.name} has started.`,
    }
  );

  return updated;
}


/**
 * Update a participant's championship statistics.
 *
 * This does NOT calculate ratings.
 * It only records championship standings.
 */
async function updateParticipant(
  championshipId,
  playerId,
  {
    totalPoints,
    totalRounds,
    accuracy,
  }
) {
  const championshipIdValue = normalizeId(championshipId);
  const playerIdValue = normalizeId(playerId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id: championshipIdValue,
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (championship.status !== CHAMPIONSHIP_STATUS.ACTIVE) {
    throwError(
      "Only an active championship can be updated",
      "CHAMPIONSHIP_NOT_ACTIVE"
    );
  }

  const participant =
    await prisma.bulletChampionshipPlayer.findUnique({
      where: {
        championshipId_playerId: {
          championshipId: championshipIdValue,
          playerId: playerIdValue,
        },
      },
    });

  if (!participant) {
    throwError(
      "Player is not registered for this championship",
      "PLAYER_NOT_REGISTERED"
    );
  }

  const points = Number(totalPoints);
  const rounds = Number(totalRounds);
  const playerAccuracy = Number(accuracy);

  if (!Number.isFinite(points) || points < 0) {
    throwError(
      "Invalid total points",
      "INVALID_TOTAL_POINTS"
    );
  }

  if (!Number.isInteger(rounds) || rounds < 0) {
    throwError(
      "Invalid total rounds",
      "INVALID_TOTAL_ROUNDS"
    );
  }

  if (
    !Number.isFinite(playerAccuracy) ||
    playerAccuracy < 0 ||
    playerAccuracy > 100
  ) {
    throwError(
      "Accuracy must be between 0 and 100",
      "INVALID_ACCURACY"
    );
  }

  return prisma.bulletChampionshipPlayer.update({
    where: {
      id: participant.id,
    },
    data: {
      totalPoints: points,
      totalRounds: rounds,
      accuracy: playerAccuracy,
    },
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          bulletRating: true,
        },
      },
    },
  });
}


/**
 * Finalize rankings and declare the champion.
 */
async function completeChampionship(
  championshipId,
  {
    championTitle = "Bullet Champion",
  } = {}
) {
  const id = normalizeId(championshipId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id,
    },
    include: {
      players: {
        include: {
          player: true,
        },
      },
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (championship.status !== CHAMPIONSHIP_STATUS.ACTIVE) {
    throwError(
      "Only an active championship can be completed",
      "CHAMPIONSHIP_NOT_ACTIVE"
    );
  }

  if (championship.players.length < 2) {
    throwError(
      "Championship must have at least two players",
      "NOT_ENOUGH_PLAYERS"
    );
  }

  /*
   * Sort:
   * 1. Total points
   * 2. Total rounds
   * 3. Accuracy
   *
   * This gives us deterministic championship standings.
   */
  const sortedPlayers = [...championship.players].sort(
    (a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (b.totalRounds !== a.totalRounds) {
        return b.totalRounds - a.totalRounds;
      }

      return b.accuracy - a.accuracy;
    }
  );

  const champion = sortedPlayers[0];

  const result = await prisma.$transaction(async (tx) => {
    /*
     * Assign final rankings.
     */
    for (let index = 0; index < sortedPlayers.length; index++) {
      await tx.bulletChampionshipPlayer.update({
        where: {
          id: sortedPlayers[index].id,
        },
        data: {
          rank: index + 1,
        },
      });
    }

    /*
     * Mark championship as completed.
     */
    const completedChampionship =
      await tx.bulletChampionship.update({
        where: {
          id,
        },
        data: {
          status: CHAMPIONSHIP_STATUS.COMPLETED,
          completedAt: new Date(),

          championPlayerId: champion.playerId,
          championUsername: champion.player.username,
          championTitle:
            typeof championTitle === "string" &&
            championTitle.trim()
              ? championTitle.trim()
              : "Bullet Champion",
        },
        include: {
          championPlayer: {
            select: {
              id: true,
              fullName: true,
              username: true,
              bulletRating: true,
              currentChampionTitle: true,
            },
          },
        },
      });

    /*
     * Award the title to the champion.
     */
    const updatedChampion = await tx.player.update({
      where: {
        id: champion.playerId,
      },
      data: {
        currentChampionTitle:
          typeof championTitle === "string" &&
          championTitle.trim()
            ? championTitle.trim()
            : "Bullet Champion",

        championshipWins: {
          increment: 1,
        },
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        bulletRating: true,
        currentChampionTitle: true,
        championshipWins: true,
      },
    });

    return {
      championship: completedChampionship,
      champion: updatedChampion,
    };
  });

  /*
   * Notify everybody after the transaction succeeds.
   */
  await createNotifications(
    championship.players.map((participant) => participant.playerId),
    {
      type: "CHAMPIONSHIP",
      title: "Championship Completed",
      message:
        `${championship.name} has been completed. ` +
        `${champion.player.fullName} is the champion.`,
    }
  );

  /*
   * Send a more specific notification to the champion.
   */
  await createNotification({
    playerId: champion.playerId,
    type: "CHAMPIONSHIP",
    title: "Congratulations!",
    message:
      `You won ${championship.name} and are now ` +
      `${result.championship.championTitle}.`,
  });

  return getChampionship(id);
}


/**
 * Cancel a championship.
 */
async function cancelChampionship(championshipId) {
  const id = normalizeId(championshipId);

  const championship = await prisma.bulletChampionship.findUnique({
    where: {
      id,
    },
    include: {
      players: true,
    },
  });

  if (!championship) {
    throwError(
      "Championship not found",
      "CHAMPIONSHIP_NOT_FOUND"
    );
  }

  if (
    championship.status === CHAMPIONSHIP_STATUS.COMPLETED
  ) {
    throwError(
      "A completed championship cannot be cancelled",
      "INVALID_CHAMPIONSHIP_STATE"
    );
  }

  if (
    championship.status === CHAMPIONSHIP_STATUS.CANCELLED
  ) {
    throwError(
      "Championship is already cancelled",
      "INVALID_CHAMPIONSHIP_STATE"
    );
  }

  const updated = await prisma.bulletChampionship.update({
    where: {
      id,
    },
    data: {
      status: CHAMPIONSHIP_STATUS.CANCELLED,
    },
  });

  if (championship.players.length > 0) {
    await createNotifications(
      championship.players.map((participant) => participant.playerId),
      {
        type: "CHAMPIONSHIP",
        title: "Championship Cancelled",
        message: `${championship.name} has been cancelled.`,
      }
    );
  }

  return updated;
}


/**
 * Normalize IDs safely.
 */
function normalizeId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throwError(
      "Valid ID is required",
      "INVALID_ID"
    );
  }

  return id;
}


function throwError(message, code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}


module.exports = {
  createChampionship,
  getChampionship,
  getChampionships,
  addPlayer,
  removePlayer,
  startChampionship,
  updateParticipant,
  completeChampionship,
  cancelChampionship,
};

