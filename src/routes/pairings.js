const express = require("express");

const router = express.Router();

const prisma = require("../lib/prisma");
const { generatePairings } = require("../utils/pairingGenerator");

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMode(mode) {
  const value = String(mode || "rapid").trim().toUpperCase();

  if (!VALID_MODES.includes(value)) {
    return null;
  }

  return value;
}


router.post("/create", async (req, res) => {
  try {
    let {
      category,
      rounds,
      intervalHours = 2,
      mode = "rapid",
    } = req.body;

    category = normalize(category);
    mode = normalizeMode(mode);

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode. Use rapid, blitz or bullet.",
      });
    }

    if (rounds !== undefined) {
      rounds = Number(rounds);

      if (!Number.isInteger(rounds) || rounds < 1) {
        return res.status(400).json({
          success: false,
          message: "Rounds must be a positive integer.",
        });
      }
    } else {
      rounds = 5;
    }

    intervalHours = Number(intervalHours);

    if (!Number.isFinite(intervalHours) || intervalHours < 0) {
      return res.status(400).json({
        success: false,
        message: "intervalHours must be a valid non-negative number.",
      });
    }

    // Get active players in category
    const players = await prisma.player.findMany({
      where: {
        category,
        status: "ACTIVE",
      },
      orderBy: {
        id: "asc",
      },
    });

    if (players.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least two active players are required.",
      });
    }

    const existingPairings = await prisma.pairing.findFirst({
      where: {
        category,
        mode,
      },
    });
    
    if (existingPairings) {
      return res.status(400).json({
        success: false,
        message: `Pairings already exist for ${category} in ${mode.toLowerCase()} mode. Delete them first before creating new pairings.`,
      });
    }

    // Generate pairings
    const generated = generatePairings(players, rounds);

    if (!generated.length) {
      return res.status(400).json({
        success: false,
        message: "Unable to generate pairings.",
      });
    }

    const now = new Date();

    const pairingRecords = generated.map((pairing) => {
      const availableAt = new Date(
        now.getTime() +
          (pairing.round - 1) * intervalHours * 60 * 60 * 1000
      );

      return {
        category,
        round: pairing.round,
        mode,

        whitePlayerId: pairing.whitePlayerId,
        blackPlayerId: pairing.blackPlayerId,

        result: "PENDING",

        whiteScore: 0,
        blackScore: 0,

        whiteChange: 0,
        blackChange: 0,

        availableAt,
      };
    });

    // Create all pairings in one transaction
    await prisma.$transaction(
      pairingRecords.map((pairing) =>
        prisma.pairing.create({
          data: pairing,
        })
      )
    );

    const created = await prisma.pairing.findMany({
      where: {
        category,
        mode,
        createdAt: {
          gte: now,
        },
      },
      include: {
        whitePlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },
        blackPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },
      },
      orderBy: [
        {
          round: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    return res.json({
      success: true,
      message: `Pairings created successfully for ${category}.`,
      category,
      mode: mode.toLowerCase(),
      rounds,
      intervalHours,
      pairings: created,
    });
  } catch (error) {
    console.error("create pairings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create pairings.",
    });
  }
});

router.get("/current/:category", async (req, res) => {
  try {
    const category = normalize(req.params.category);

    const mode = normalizeMode(req.query.mode || "rapid");

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode.",
      });
    }

    const pairings = await prisma.pairing.findMany({
      where: {
        category,
        mode,
      },

      include: {
        whitePlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },
      },

      orderBy: [
        {
          round: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const now = Date.now();

    const visibleRounds = [];

    let nextRoundAt = null;

    const grouped = {};

    for (const pairing of pairings) {
      if (!grouped[pairing.round]) {
        grouped[pairing.round] = {
          round: pairing.round,
          availableAt: pairing.availableAt,
          pairings: [],
        };
      }

      grouped[pairing.round].pairings.push(pairing);
    }

    const rounds = Object.values(grouped);

    for (const round of rounds) {
      const available =
        round.availableAt &&
        new Date(round.availableAt).getTime();

      if (!available || available <= now) {
        visibleRounds.push(round);
      } else if (!nextRoundAt) {
        nextRoundAt = round.availableAt;
      }
    }

    return res.json({
      success: true,
      category,
      mode: mode.toLowerCase(),
      visibleRounds,
      nextRoundAt,
    });
  } catch (error) {
    console.error("get pairings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load pairings.",
    });
  }
});


router.get("/current", async (req, res) => {
  try {
    const mode = normalizeMode(req.query.mode || "rapid");

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode.",
      });
    }

    const pairings = await prisma.pairing.findMany({
      where: {
        mode,
      },

      include: {
        whitePlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },

        blackPlayer: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },
      },

      orderBy: [
        {
          category: "asc",
        },
        {
          round: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const now = Date.now();

    const result = {};

    for (const pairing of pairings) {
      if (!result[pairing.category]) {
        result[pairing.category] = {};
      }

      if (!result[pairing.category][pairing.round]) {
        result[pairing.category][pairing.round] = {
          round: pairing.round,
          availableAt: pairing.availableAt,
          pairings: [],
        };
      }

      result[pairing.category][pairing.round].pairings.push(pairing);
    }

    const formatted = {};

    for (const [category, roundData] of Object.entries(result)) {
      const rounds = Object.values(roundData);

      const visibleRounds = rounds.filter((round) => {
        if (!round.availableAt) return true;

        return new Date(round.availableAt).getTime() <= now;
      });

      const nextRound = rounds.find(
        (round) =>
          round.availableAt &&
          new Date(round.availableAt).getTime() > now
      );

      formatted[category] = {
        visibleRounds,
        nextRoundAt: nextRound?.availableAt || null,
      };
    }

    return res.json({
      success: true,
      mode: mode.toLowerCase(),
      data: formatted,
    });
  } catch (error) {
    console.error("get all pairings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load pairings.",
    });
  }
});



//Delete pairings 
router.delete("/:category", async (req, res) => {
  try {
    const category = normalize(req.params.category);

    const mode = normalizeMode(req.query.mode || "rapid");

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid mode.",
      });
    }

    const existing = await prisma.pairing.count({
      where: {
        category,
        mode,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `No pairings found for ${category}.`,
      });
    }

    await prisma.pairing.deleteMany({
      where: {
        category,
        mode,
      },
    });

    return res.json({
      success: true,
      message: `Pairings deleted successfully for ${category}.`,
      category,
      mode: mode.toLowerCase(),
    });
  } catch (error) {
    console.error("delete pairings error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete pairings.",
    });
  }
});

module.exports = router;
