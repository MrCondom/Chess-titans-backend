const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const playerAuth = require("../middleware/playerAuth");

const resultService = require("../services/resultService");


router.post(
  "/",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = req.player.id;

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
        code:
          error.code ||
          "RESULT_SUBMISSION_ERROR",
      });
    }
  }
);


router.get(
  "/my",
  playerAuth,
  async (req, res) => {
    try {
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
        code:
          error.code ||
          "RESULT_ERROR",
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
        code:
          error.code ||
          "RESULT_ERROR",
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
        await resultService.getResultById(
          req.params.id
        );

      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Result not found.",
        });
      }

      const playerId =
        Number(req.player.id);

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
        code:
          error.code ||
          "RESULT_ERROR",
      });
    }
  }
);


module.exports = router;

