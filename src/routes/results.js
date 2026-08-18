const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const playerAuth = require("../middleware/playerAuth");

const resultService = require("../services/resultService");
const ratingService = require("../services/ratingService");


router.post("/", playerAuth, async (req, res) => {
  try {
    if (!req.player || !req.player.id) {
      return res.status(401).json({
        success: false,
        message: "Player authentication required.",
      });
    }

    const playerId = Number(req.player.id);

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid player session.",
      });
    }

    const {
      pairingId,
      whiteScore,
      blackScore,
    } = req.body;

    const result =
      await resultService.submitResult({
        pairingId,
        playerId,
        whiteScore,
        blackScore,
      });

    return res.status(201).json({
      success: true,
      message:
        "Result submitted successfully and is awaiting approval.",
      result,
    });

  } catch (error) {
    console.error(
      "SUBMIT RESULT ERROR:",
      error
    );

    if (
      error.code === "PAIRING_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === "NOT_PAIRING_PARTICIPANT"
    ) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === "RESULT_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to submit result.",
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

    if (
      !Number.isInteger(playerId) ||
      playerId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid player session.",
      });
    }

    const {
      category,
      round,
      mode,
      approvalStatus,
    } = req.query;

    const results =
      await resultService.getPlayerResults(
        playerId,
        {
          category,
          round,
          mode,
          approvalStatus,
        }
      );

    return res.status(200).json({
      success: true,
      count: results.length,
      results,
    });

  } catch (error) {
    console.error(
      "GET MY RESULTS ERROR:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve results.",
    });
  }
});


router.get(
  "/:id",
  playerAuth,
  async (req, res) => {
    try {
      if (!req.player || !req.player.id) {
        return res.status(401).json({
          success: false,
          message:
            "Player authentication required.",
        });
      }

      const playerId =
        Number(req.player.id);

      const resultId =
        Number(req.params.id);

      if (
        !Number.isInteger(resultId) ||
        resultId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid result ID.",
        });
      }

      const result =
        await resultService.getResultById(
          resultId
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Result not found.",
        });
      }

      const isParticipant =
        result.whitePlayerId === playerId ||
        result.blackPlayerId === playerId;

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to view this result.",
        });
      }

      return res.status(200).json({
        success: true,
        result,
      });

    } catch (error) {
      console.error(
        "GET RESULT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve result.",
      });
    }
  }
);


router.get(
  "/admin/all",
  adminAuth,
  async (req, res) => {
    try {
      const {
        category,
        round,
        mode,
        approvalStatus,
      } = req.query;

      const results =
        await resultService.getAllResults({
          category,
          round,
          mode,
          approvalStatus,
        });

      return res.status(200).json({
        success: true,
        count: results.length,
        results,
      });

    } catch (error) {
      console.error(
        "GET ALL RESULTS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to retrieve results.",
      });
    }
  }
);

router.post(
  "/",
  playerAuth,
  async (req, res) => {
    try {
      const playerId =
        req.player.id;

      const {
        pairingId,
        whiteScore,
        blackScore,
      } = req.body;

      const result =
        await ratingService.submitResult({
          pairingId,
          playerId,
          whiteScore,
          blackScore,
        });

      return res.status(201).json({
        success: true,
        message:
          "Result submitted successfully. Awaiting approval.",
        result,
      });
    } catch (error) {
      console.error(
        "SUBMIT RESULT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "RESULT_SUBMISSION_ERROR",
      });
    }
  }
);

router.get(
  "/mine",
  playerAuth,
  async (req, res) => {
    try {
      const results =
        await ratingService.getPlayerResults(
          req.player.id,
          {
            mode: req.query.mode,
            round: req.query.round,
            category:
              req.query.category,
            approvalStatus:
              req.query.approvalStatus,
          }
        );

      return res.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error(
        "GET PLAYER RESULTS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.get(
  "/:id",
  playerAuth,
  async (req, res) => {
    try {
      const result =
        await ratingService.getResultById(
          req.params.id
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Result not found.",
        });
      }

      // Security:
      // player can only see their own result.
      const playerId =
        req.player.id;

      if (
        result.whitePlayerId !== playerId &&
        result.blackPlayerId !== playerId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to view this result.",
        });
      }

      return res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error(
        "GET RESULT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);



module.exports = router;