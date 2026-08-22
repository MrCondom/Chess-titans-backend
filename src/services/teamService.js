const prisma = require("../lib/prisma");
const notificationService = require("./notificationService");


const MAX_TEAM_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1000;


function validateId(value, name = "ID") {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${name}.`);
    error.code = "INVALID_ID";
    throw error;
  }

  return id;
}


function validateTeamName(name) {
  if (typeof name !== "string") {
    const error = new Error("Team name must be a string.");
    error.code = "INVALID_TEAM_NAME";
    throw error;
  }

  const value = name.trim();

  if (!value) {
    const error = new Error("Team name is required.");
    error.code = "INVALID_TEAM_NAME";
    throw error;
  }

  if (value.length > MAX_TEAM_NAME_LENGTH) {
    const error = new Error(
      `Team name cannot exceed ${MAX_TEAM_NAME_LENGTH} characters.`
    );

    error.code = "INVALID_TEAM_NAME";

    throw error;
  }

  return value;
}


function validateDescription(description) {
  if (description === undefined || description === null) {
    return "";
  }

  if (typeof description !== "string") {
    const error = new Error("Team description must be a string.");
    error.code = "INVALID_DESCRIPTION";
    throw error;
  }

  const value = description.trim();

  if (value.length > MAX_DESCRIPTION_LENGTH) {
    const error = new Error(
      `Team description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters.`
    );

    error.code = "INVALID_DESCRIPTION";

    throw error;
  }

  return value;
}



const teamListInclude = {
  captain: {
    select: {
      id: true,
      fullName: true,
      username: true,
      status: true,
    },
  },

  players: {
    where: {
      status: "ACTIVE",
    },

    orderBy: {
      fullName: "asc",
    },

    select: {
      id: true,
      fullName: true,
      username: true,
      status: true,
      category: true,
      rapidRating: true,
      blitzRating: true,
      bulletRating: true,
      rapidGain: true,
      blitzGain: true,
      bulletGain: true,
      totalPoints: true,
      totalRounds: true,
      teamId: true,
    },
  },

  _count: {
    select: {
      players: true,
      memberships: true,
    },
  },
};


async function createTeam({
  name,
  description = "",
  captainId = null,
}) {
  const teamName = validateTeamName(name);
  const teamDescription = validateDescription(description);

  if (captainId !== null && captainId !== undefined) {
    captainId = validateId(captainId, "captain ID");
  } else {
    captainId = null;
  }

  const existingTeam = await prisma.team.findUnique({
    where: {
      name: teamName,
    },
  });

  if (existingTeam) {
    const error = new Error(
      "A team with this name already exists."
    );

    error.code = "TEAM_NAME_EXISTS";

    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    let captain = null;

    if (captainId) {
      captain = await tx.player.findUnique({
        where: {
          id: captainId,
        },
      });

      if (!captain) {
        const error = new Error("Captain not found.");
        error.code = "PLAYER_NOT_FOUND";
        throw error;
      }

      if (captain.status !== "ACTIVE") {
        const error = new Error(
          "An inactive player cannot be captain."
        );

        error.code = "PLAYER_INACTIVE";

        throw error;
      }

      /*
       * A player can only belong to one current team.
       */
      if (captain.teamId !== null) {
        const error = new Error(
          "This player already belongs to a team."
        );

        error.code = "PLAYER_ALREADY_IN_TEAM";

        throw error;
      }
    }

    const team = await tx.team.create({
      data: {
        name: teamName,
        description: teamDescription,
        captainId,
      },
    });

    /*
     * Captain automatically becomes a team member.
     */
    if (captainId) {
      await tx.player.update({
        where: {
          id: captainId,
        },

        data: {
          teamId: team.id,
        },
      });

      await tx.teamMembership.create({
        data: {
          teamId: team.id,
          playerId: captainId,
          status: "ACTIVE",
        },
      });
    }

    return tx.team.findUnique({
      where: {
        id: team.id,
      },

      include: teamListInclude,
    });
  });

  
  if (captainId) {
    try {
      await notificationService.createNotification({
        playerId: captainId,
        type: "SYSTEM",
        title: "Team Created",
        message: `You have been appointed captain of ${result.name}.`,
      });
    } catch (error) {
      console.error(
        "TEAM CREATION NOTIFICATION ERROR:",
        error
      );
    }
  }

  return result;
}


async function getTeamById(teamId) {
  teamId = validateId(teamId, "team ID");

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },

    include: teamListInclude,
  });

  if (!team) {
    const error = new Error("Team not found.");
    error.code = "TEAM_NOT_FOUND";
    throw error;
  }

  return team;
}



async function getAllTeams({
  page = 1,
  limit = 20,
  search = null,
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

  if (search && typeof search === "string") {
    where.name = {
      contains: search.trim(),
    };
  }

  const skip = (page - 1) * limit;

  const [teams, total] = await prisma.$transaction([
    prisma.team.findMany({
      where,
      skip,
      take: limit,

      include: teamListInclude,

      orderBy: [
        {
          totalPoints: "desc",
        },
        {
          name: "asc",
        },
      ],
    }),

    prisma.team.count({
      where,
    }),
  ]);

  return {
    teams,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


async function updateTeam(
  teamId,
  {
    name,
    description,
  }
) {
  teamId = validateId(teamId, "team ID");

  const existingTeam = await prisma.team.findUnique({
    where: {
      id: teamId,
    },
  });

  if (!existingTeam) {
    const error = new Error("Team not found.");
    error.code = "TEAM_NOT_FOUND";
    throw error;
  }

  const data = {};

  if (name !== undefined) {
    data.name = validateTeamName(name);

    const duplicate = await prisma.team.findFirst({
      where: {
        name: data.name,
        NOT: {
          id: teamId,
        },
      },
    });

    if (duplicate) {
      const error = new Error(
        "A team with this name already exists."
      );

      error.code = "TEAM_NAME_EXISTS";

      throw error;
    }
  }

  if (description !== undefined) {
    data.description = validateDescription(description);
  }

  if (Object.keys(data).length === 0) {
    const error = new Error(
      "No valid team changes supplied."
    );

    error.code = "INVALID_TEAM_UPDATE";

    throw error;
  }

  return prisma.team.update({
    where: {
      id: teamId,
    },

    data,

    include: teamListInclude,
  });
}



async function deleteTeam(teamId) {
  teamId = validateId(teamId, "team ID");

  const team = await prisma.team.findUnique({
    where: {
      id: teamId,
    },

  
      
        select: {
          id: true,
          captainId: true
        },
  });

  if (!team) {
    const error = new Error("Team not found.");
    error.code = "TEAM_NOT_FOUND";
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.player.updateMany({
      where: {
        teamId: teamId,
      },

      data: {
        teamId: null,
      },
    });

    await tx.team.update({
      where: {
        id: teamId,
      },

      data: {
        captainId: null,
      },
    });

    await tx.teamMembership.deleteMany({
      where: {
        teamId: teamId
      }
    });

    await tx.team.delete({
      where: {
        id: teamId,
      },
    });
  });

  return {
    success: true,
    message: "Team deleted successfully.",
    teamId,
  };
}



async function addPlayerToTeam(teamId, playerId) {
  teamId = validateId(teamId, "team ID");
  playerId = validateId(playerId, "player ID");

  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      const error = new Error("Team not found.");
      error.code = "TEAM_NOT_FOUND";
      throw error;
    }

    const player = await tx.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      const error = new Error("Player not found.");
      error.code = "PLAYER_NOT_FOUND";
      throw error;
    }

    if (player.status !== "ACTIVE") {
      const error = new Error(
        "An inactive player cannot join a team."
      );

      error.code = "PLAYER_INACTIVE";

      throw error;
    }

    /*
     * Already on this team.
     */
    if (player.teamId === teamId) {
      const error = new Error(
        "Player is already a member of this team."
      );

      error.code = "ALREADY_TEAM_MEMBER";

      throw error;
    }

    /*
     * Player cannot simultaneously belong to another team.
     */
    if (player.teamId !== null) {
      const error = new Error(
        "Player already belongs to another team."
      );

      error.code = "PLAYER_ALREADY_IN_TEAM";

      throw error;
    }

    
    const existingMembership =
      await tx.teamMembership.findUnique({
        where: {
          teamId_playerId: {
            teamId,
            playerId,
          },
        },
      });

    let membership;

    if (existingMembership) {
      membership = await tx.teamMembership.update({
        where: {
          id: existingMembership.id,
        },

        data: {
          status: "ACTIVE",
          joinedAt: new Date(),
          leftAt: null,
        },
      });
    } else {
      membership = await tx.teamMembership.create({
        data: {
          teamId,
          playerId,
          status: "ACTIVE",
        },
      });
    }

    await tx.player.update({
      where: {
        id: playerId,
      },

      data: {
        teamId,
      },
    });

    return {
      membership,
      team,
      player,
    };
  });

  try {
    await notificationService.createNotification({
      playerId,
      type: "SYSTEM",
      title: "Team Membership",
      message: `You have joined ${result.team.name}.`,
    });
  } catch (error) {
    console.error(
      "TEAM MEMBERSHIP NOTIFICATION ERROR:",
      error
    );
  }

  return getTeamById(teamId);
}


async function removePlayerFromTeam(teamId, playerId) {
  teamId = validateId(teamId, "team ID");
  playerId = validateId(playerId, "player ID");

  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      const error = new Error("Team not found.");
      error.code = "TEAM_NOT_FOUND";
      throw error;
    }

    const player = await tx.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      const error = new Error("Player not found.");
      error.code = "PLAYER_NOT_FOUND";
      throw error;
    }

    if (player.teamId !== teamId) {
      const error = new Error(
        "Player is not currently a member of this team."
      );

      error.code = "NOT_TEAM_MEMBER";

      throw error;
    }

    
    if (team.captainId === playerId) {
      const error = new Error(
        "The team captain cannot be removed. Appoint another captain first."
      );

      error.code = "CAPTAIN_CANNOT_BE_REMOVED";

      throw error;
    }

    const membership =
      await tx.teamMembership.findUnique({
        where: {
          teamId_playerId: {
            teamId,
            playerId,
          },
        },
      });

    if (membership) {
      await tx.teamMembership.update({
        where: {
          id: membership.id,
        },

        data: {
          status: "INACTIVE",
          leftAt: new Date(),
        },
      });
    }

    await tx.player.update({
      where: {
        id: playerId,
      },

      data: {
        teamId: null,
      },
    });

    return {
      player,
      team,
    };
  });

  try {
    await notificationService.createNotification({
      playerId,
      type: "SYSTEM",
      title: "Team Membership",
      message: `You have left ${result.team.name}.`,
    });
  } catch (error) {
    console.error(
      "TEAM MEMBERSHIP NOTIFICATION ERROR:",
      error
    );
  }

  return getTeamById(teamId);
}



async function appointCaptain(teamId, playerId) {
  teamId = validateId(teamId, "team ID");
  playerId = validateId(playerId, "player ID");

  const result = await prisma.$transaction(async (tx) => {
    const team = await tx.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      const error = new Error("Team not found.");
      error.code = "TEAM_NOT_FOUND";
      throw error;
    }

    const player = await tx.player.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!player) {
      const error = new Error("Player not found.");
      error.code = "PLAYER_NOT_FOUND";
      throw error;
    }

    if (player.status !== "ACTIVE") {
      const error = new Error(
        "An inactive player cannot be captain."
      );

      error.code = "PLAYER_INACTIVE";

      throw error;
    }

    if (player.teamId !== teamId) {
      const error = new Error(
        "The captain must be a member of the team."
      );

      error.code = "CAPTAIN_NOT_TEAM_MEMBER";

      throw error;
    }

    if (team.captainId === playerId) {
      return {
        team,
        player,
        changed: false,
      };
    }

   
    const updatedTeam = await tx.team.update({
      where: {
        id: teamId,
      },

      data: {
        captainId: playerId,
      },
    });

    return {
      team: updatedTeam,
      player,
      changed: true,
    };
  });

  if (result.changed) {
    try {
      await notificationService.createNotification({
        playerId,
        type: "SYSTEM",
        title: "Team Captain",
        message: `You are now the captain of ${result.team.name}.`,
      });
    } catch (error) {
      console.error(
        "CAPTAIN NOTIFICATION ERROR:",
        error
      );
    }
  }

  return getTeamById(teamId);
}


async function getTeamMemberships(
  teamId,
  {
    status = null,
    page = 1,
    limit = 50,
  } = {}
) {
  teamId = validateId(teamId, "team ID");

  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 50;
  }

  if (limit > 100) {
    limit = 100;
  }

  const where = {
    teamId,
  };

  if (status) {
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      const error = new Error(
        "Invalid membership status."
      );

      error.code = "INVALID_MEMBERSHIP_STATUS";

      throw error;
    }

    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [memberships, total] =
    await prisma.$transaction([
      prisma.teamMembership.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          joinedAt: "desc",
        },

        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              status: true,
              category: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
            },
          },
        },
      }),

      prisma.teamMembership.count({
        where,
      }),
    ]);

  return {
    memberships,

    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


async function getPlayerTeam(playerId) {
  playerId = validateId(playerId, "player ID");

  const player = await prisma.player.findUnique({
    where: {
      id: playerId,
    },

    select: {
      id: true,
      teamId: true,
    },
  });

  if (!player) {
    const error = new Error("Player not found.");
    error.code = "PLAYER_NOT_FOUND";
    throw error;
  }

  if (!player.teamId) {
    return null;
  }

  return getTeamById(player.teamId);
}


module.exports = {
  createTeam,
  getTeamById,
  getAllTeams,
  updateTeam,
  deleteTeam,

  addPlayerToTeam,
  removePlayerFromTeam,
  appointCaptain,

  getTeamMemberships,
  getPlayerTeam,

};
