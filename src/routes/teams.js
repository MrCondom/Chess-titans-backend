const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}


router.post("/", async (req, res) => {
  try {
    const name = normalizeName(req.body.name);
    const description = normalizeName(req.body.description);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Team name is required.",
      });
    }

    const existingTeam = await prisma.team.findUnique({
      where: {
        name,
      },
    });

    if (existingTeam) {
      return res.status(400).json({
        success: false,
        message: "A team with this name already exists.",
      });
    }

    const team = await prisma.team.create({
      data: {
        name,
        description,
      },
      include: {
        players: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Team created successfully.",
      team,
    });
  } catch (error) {
    console.error("Create team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create team.",
    });
  }
});


router.get("/", async (req, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        players: {
          orderBy: {
            fullName: "asc",
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json({
      success: true,
      teams,
    });
  } catch (error) {
    console.error("Get teams error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch teams.",
    });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const teamId = Number(req.params.id);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        players: {
          orderBy: {
            fullName: "asc",
          },
        },

        teamPairingsAsTeamA: {
          include: {
            teamA: true,
            teamB: true,
          },
          orderBy: {
            round: "asc",
          },
        },

        teamPairingsAsTeamB: {
          include: {
            teamA: true,
            teamB: true,
          },
          orderBy: {
            round: "asc",
          },
        },

        rankings: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }

    res.json({
      success: true,
      team,
    });
  } catch (error) {
    console.error("Get team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch team.",
    });
  }
});


router.put("/:id", async (req, res) => {
  try {
    const teamId = Number(req.params.id);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }

    const data = {};

    if (req.body.name !== undefined) {
      const name = normalizeName(req.body.name);

      if (!name) {
        return res.status(400).json({
          success: false,
          message: "Team name cannot be empty.",
        });
      }

      if (name !== team.name) {
        const duplicate = await prisma.team.findUnique({
          where: {
            name,
          },
        });

        if (duplicate) {
          return res.status(400).json({
            success: false,
            message: "A team with this name already exists.",
          });
        }
      }

      data.name = name;
    }

    if (req.body.description !== undefined) {
      data.description = normalizeName(req.body.description);
    }

    const updatedTeam = await prisma.team.update({
      where: {
        id: teamId,
      },
      data,
      include: {
        players: true,
      },
    });

    res.json({
      success: true,
      message: "Team updated successfully.",
      team: updatedTeam,
    });
  } catch (error) {
    console.error("Edit team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update team.",
    });
  }
});


router.post("/:id/players", async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const username = normalizeUsername(req.body.username);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        username,
      },
      include: {
        team: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }


    if (player.teamId && player.teamId !== teamId) {
      return res.status(400).json({
        success: false,
        message: `Player already belongs to team "${player.team.name}".`,
      });
    }

    if (player.teamId === teamId) {
      return res.status(400).json({
        success: false,
        message: "Player is already in this team.",
      });
    }

    const updatedPlayer = await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        teamId,
      },
      include: {
        team: true,
      },
    });

    res.json({
      success: true,
      message: `${player.username} added to ${team.name}.`,
      player: updatedPlayer,
    });
  } catch (error) {
    console.error("Add player to team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add player to team.",
    });
  }
});


router.delete("/:id/players/:username", async (req, res) => {
  try {
    const teamId = Number(req.params.id);
    const username = normalizeUsername(req.params.username);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        username,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    if (player.teamId !== teamId) {
      return res.status(400).json({
        success: false,
        message: "Player does not belong to this team.",
      });
    }

    const updatedPlayer = await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        teamId: null,
      },
    });

    res.json({
      success: true,
      message: `${username} removed from team.`,
      player: updatedPlayer,
    });
  } catch (error) {
    console.error("Remove player from team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove player from team.",
    });
  }
});


router.patch("/remove-player/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

    const player = await prisma.player.findUnique({
      where: {
        username,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    if (!player.teamId) {
      return res.status(400).json({
        success: false,
        message: "Player does not belong to a team.",
      });
    }

    const updatedPlayer = await prisma.player.update({
      where: {
        id: player.id,
      },
      data: {
        teamId: null,
      },
    });

    res.json({
      success: true,
      message: `${username} removed from their team.`,
      player: updatedPlayer,
    });
  } catch (error) {
    console.error("Remove player error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove player from team.",
    });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const teamId = Number(req.params.id);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        players: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }


    await prisma.$transaction(async (tx) => {
      await tx.player.updateMany({
        where: {
          teamId,
        },
        data: {
          teamId: null,
        },
      });

      await tx.team.delete({
        where: {
          id: teamId,
        },
      });
    });

    res.json({
      success: true,
      message: `Team "${team.name}" deleted successfully.`,
    });
  } catch (error) {
    console.error("Delete team error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete team.",
    });
  }
});


router.get("/:id/summary", async (req, res) => {
  try {
    const teamId = Number(req.params.id);

    if (!Number.isInteger(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      include: {
        players: true,
      },
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }

    const summary = {
      teamId: team.id,
      teamName: team.name,

      players: team.players.length,

      totalPoints: team.players.reduce(
        (total, player) => total + player.totalPoints,
        0
      ),

      rapidGain: team.players.reduce(
        (total, player) => total + player.rapidGain,
        0
      ),

      blitzGain: team.players.reduce(
        (total, player) => total + player.blitzGain,
        0
      ),

      bulletGain: team.players.reduce(
        (total, player) => total + player.bulletGain,
        0
      ),
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Team summary error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to calculate team summary.",
    });
  }
});

module.exports = router;
