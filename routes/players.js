const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");


function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeCategory(category) {
  const value = String(category || "").trim().toLowerCase();
  return value || "unavailable";
}



router.get("/all", async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      include: {
        team: true,
      },
      orderBy: [
        {
          rapidRating: "desc",
        },
        {
          blitzRating: "desc",
        },
        {
          bulletRating: "desc",
        },
        {
          fullName: "asc",
        },
      ],
    });

    const grouped = {};

    for (const player of players) {
      const category = normalizeCategory(player.category);

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(player);
    }

    

    const categoryOrder = [
      "heavyweight",
      "middleweight",
      "lightweight",
    ];

    const orderedGrouped = {};

    categoryOrder.forEach((category) => {
      if (grouped[category]) {
        orderedGrouped[category] = grouped[category];
      }
    });

    
    Object.keys(grouped)
      .filter(
        (category) =>
          !categoryOrder.includes(category) &&
          category !== "unavailable"
      )
      .sort()
      .forEach((category) => {
        orderedGrouped[category] = grouped[category];
      });

    

    if (grouped.unavailable) {
      orderedGrouped.unavailable = grouped.unavailable;
    }

    res.json(orderedGrouped);
  } catch (error) {
    console.error("GET /players/all error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch players.",
    });
  }
});


router.get("/:username", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);

    const player = await prisma.player.findUnique({
      where: {
        username,
      },
      include: {
        team: true,
        rankings: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    res.json({
      success: true,
      player,
    });
  } catch (error) {
    console.error("GET player error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch player.",
    });
  }
});



router.post("/", async (req, res) => {
  try {
    const {
      fullName,
      username,
      rapid,
      blitz,
      bullet,
      category,
      bio,
      status,
    } = req.body;

    const cleanFullName = String(fullName || "").trim();
    const cleanUsername = normalizeUsername(username);
    const cleanCategory = normalizeCategory(category);
    const cleanBio = String(bio || "").trim();

    const rapidRating = Number(rapid);
    const blitzRating = Number(blitz);
    const bulletRating = Number(bullet);

    

    if (!cleanFullName) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    if (!cleanUsername) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    if (
      !Number.isFinite(rapidRating) ||
      !Number.isFinite(blitzRating) ||
      !Number.isFinite(bulletRating)
    ) {
      return res.status(400).json({
        success: false,
        message: "Rapid, blitz and bullet ratings must be valid numbers.",
      });
    }

    

    const existingPlayer = await prisma.player.findUnique({
      where: {
        username: cleanUsername,
      },
    });

    if (existingPlayer) {
      return res.status(400).json({
        success: false,
        message: "Username already exists.",
      });
    }

  

    const player = await prisma.player.create({
      data: {
        fullName: cleanFullName,
        username: cleanUsername,

        rapidRating,
        blitzRating,
        bulletRating,

        rapidGain: 0,
        blitzGain: 0,
        bulletGain: 0,

        category: cleanCategory,

        bio: cleanBio,

        status:
          status === "INACTIVE"
            ? "INACTIVE"
            : "ACTIVE",
      },
      include: {
        team: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Player added successfully.",
      player,
    });
  } catch (error) {
    console.error("POST /players error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add player.",
    });
  }
});


router.put("/:username", async (req, res) => {
  try {
    const currentUsername = normalizeUsername(req.params.username);

    const {
      fullName,
      username,
      rapid,
      blitz,
      bullet,
      category,
      bio,
      status,
    } = req.body;

    const existingPlayer = await prisma.player.findUnique({
      where: {
        username: currentUsername,
      },
    });

    if (!existingPlayer) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    const data = {};

    

    if (fullName !== undefined) {
      const cleanFullName = String(fullName).trim();

      if (!cleanFullName) {
        return res.status(400).json({
          success: false,
          message: "Full name cannot be empty.",
        });
      }

      data.fullName = cleanFullName;
    }


    if (username !== undefined) {
      const newUsername = normalizeUsername(username);

      if (!newUsername) {
        return res.status(400).json({
          success: false,
          message: "Username cannot be empty.",
        });
      }

      if (newUsername !== currentUsername) {
        const usernameExists = await prisma.player.findUnique({
          where: {
            username: newUsername,
          },
        });

        if (usernameExists) {
          return res.status(400).json({
            success: false,
            message: "Username already exists.",
          });
        }

        data.username = newUsername;
      }
    }


    if (rapid !== undefined) {
      const value = Number(rapid);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message: "Invalid rapid rating.",
        });
      }

      data.rapidRating = value;
    }

    if (blitz !== undefined) {
      const value = Number(blitz);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message: "Invalid blitz rating.",
        });
      }

      data.blitzRating = value;
    }

    if (bullet !== undefined) {
      const value = Number(bullet);

      if (!Number.isFinite(value)) {
        return res.status(400).json({
          success: false,
          message: "Invalid bullet rating.",
        });
      }

      data.bulletRating = value;
    }


    if (category !== undefined) {
      data.category = normalizeCategory(category);
    }


    if (bio !== undefined) {
      data.bio = String(bio).trim();
    }


    if (status !== undefined) {
      if (!["ACTIVE", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid player status.",
        });
      }

      data.status = status;
    }

   
    const player = await prisma.player.update({
      where: {
        username: currentUsername,
      },
      data,
      include: {
        team: true,
      },
    });

    res.json({
      success: true,
      message: "Player updated successfully.",
      player,
    });
  } catch (error) {
    console.error("PUT /players/:username error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update player.",
    });
  }
});


router.patch("/:username/status", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be ACTIVE or INACTIVE.",
      });
    }

    const player = await prisma.player.update({
      where: {
        username,
      },
      data: {
        status,
      },
    });

    res.json({
      success: true,
      message: `Player marked as ${status}.`,
      player,
    });
  } catch (error) {
    console.error("Update player status error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update player status.",
    });
  }
});


router.patch("/:username/bio", async (req, res) => {
  try {
    const username = normalizeUsername(req.params.username);
    const bio = String(req.body.bio || "").trim();

    const player = await prisma.player.update({
      where: {
        username,
      },
      data: {
        bio,
      },
    });

    res.json({
      success: true,
      message: "Bio updated successfully.",
      player,
    });
  } catch (error) {
    console.error("Update bio error:", error);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update bio.",
    });
  }
});


router.delete("/:username", async (req, res) => {
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

    await prisma.player.delete({
      where: {
        username,
      },
    });

    res.json({
      success: true,
      message: `Player ${username} deleted successfully.`,
    });
  } catch (error) {
    console.error("DELETE player error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete player.",
    });
  }
});

module.exports = router;
