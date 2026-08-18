const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");

const adminAuth = require("../middleware/adminAuth");
const playerAuth = require("../middleware/playerAuth");

const pairingService = require("../services/pairingService");


router.post("/generate", adminAuth, async (req, res) => {
  try {
    const {
      category,
      round,
      mode,
      availableAt,
    } = req.body;

    const parsedRound = Number(round);

    let parsedAvailableAt;

    if (availableAt !== undefined) {
      parsedAvailableAt = new Date(availableAt);

      if (Number.isNaN(parsedAvailableAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid availableAt date.",
        });
      }
    } else {
      parsedAvailableAt = new Date();
    }

    const result =
      await pairingService.generatePairings({
        category,
        round: parsedRound,
        mode,
        availableAt: parsedAvailableAt,
      });

    return res.status(201).json({
      success: true,
      message: "Pairings generated successfully.",
      ...result,
    });
  } catch (error) {
    console.error(
      "GENERATE PAIRINGS ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message ||
        "Failed to generate pairings.",
    });
  }
});


router.get("/", playerAuth, async (req, res) => {
  try {
    const {
      category,
      round,
      mode,
    } = req.query;

    let parsedRound;

    if (round !== undefined) {
      parsedRound = Number(round);

      if (
        !Number.isInteger(parsedRound) ||
        parsedRound <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid round.",
        });
      }
    }

    const pairings =
      await pairingService.getAllPairings({
        category,
        round: parsedRound,
        mode,
      });

    return res.status(200).json({
      success: true,
      count: pairings.length,
      pairings,
    });
  } catch (error) {
    console.error(
      "GET ALL PAIRINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pairings.",
    });
  }
});


router.get("/my", playerAuth, async (req, res) => {
  try {
    if (!req.player || !req.player.id) {
      return res.status(401).json({
        success: false,
        message: "Player authentication required.",
      });
    }

    const playerId = Number(req.player.id);

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid player session.",
      });
    }

    const {
      category,
      round,
      mode,
    } = req.query;

    let parsedRound;

    if (round !== undefined) {
      parsedRound = Number(round);

      if (
        !Number.isInteger(parsedRound) ||
        parsedRound <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid round.",
        });
      }
    }

    const pairings =
      await pairingService.getPlayerPairings(
        playerId,
        {
          category,
          round: parsedRound,
          mode,
        }
      );

    return res.status(200).json({
      success: true,
      count: pairings.length,
      pairings,
    });
  } catch (error) {
    console.error(
      "GET MY PAIRINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve your pairings.",
    });
  }
});


router.get("/:id", playerAuth, async (req, res) => {
  try {
    if (!req.player || !req.player.id) {
      return res.status(401).json({
        success: false,
        message: "Player authentication required.",
      });
    }

    const pairingId = Number(req.params.id);
    const playerId = Number(req.player.id);

    if (
      !Number.isInteger(pairingId) ||
      pairingId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid pairing ID.",
      });
    }

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid player session.",
      });
    }

    const pairing =
      await pairingService.getPairingById(
        pairingId
      );

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: "Pairing not found.",
      });
    }

    const isParticipant =
      pairing.whitePlayerId === playerId ||
      pairing.blackPlayerId === playerId;

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this pairing.",
      });
    }

    return res.status(200).json({
      success: true,
      pairing,
    });
  } catch (error) {
    console.error(
      "GET SINGLE PAIRING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pairing.",
    });
  }
});


module.exports = router;
