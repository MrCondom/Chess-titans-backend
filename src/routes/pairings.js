const express = require("express");

const router = express.Router();

const pairingService =
  require("../services/pairingService");

const adminAuth =
  require("../middleware/adminAuth");


router.post(
  "/generate",
  adminAuth,
  async (req, res) => {
    try {
      const {
        tournamentId,
        round,
        availableAt,
      } = req.body;

      const result =
        await pairingService.generatePairings({
          tournamentId,
          round,
          availableAt,
        });

      res.json({
        success: true,
        message:
          "Pairings generated successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "GENERATE PAIRINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  "/team/generate",
  adminAuth,
  async (req, res) => {
    try {
      const {
        tournamentId,
        round,
        availableAt,
      } = req.body;

      const result =
        await pairingService.generateTeamPairings({
          tournamentId,
          round,
          availableAt,
        });

      res.json({
        success: true,
        message:
          "Team pairings generated successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "GENERATE TEAM PAIRINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.delete(
  "/delete",
  adminAuth,
  async (req, res) => {
    try {
      const {
        tournamentId,
        round,
      } = req.body;

      const result =
        await pairingService.deletePairings({
          tournamentId,
          round,
        });

      res.json({
        success: true,
        message:
          "Pairings deleted successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "DELETE PAIRINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  "/team/table/generate",
  adminAuth,
  async (req, res) => {
    try {
      const {
        teamPairingId,
      } = req.body;

      const result =
        await pairingService
          .generateTeamTablePairings({
            teamPairingId,
          });

      res.json({
        success: true,
        message:
          "Team table pairings generated successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "GENERATE TEAM TABLE PAIRINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.delete(
  "/team/delete",
  adminAuth,
  async (req, res) => {
    try {
      const {
        tournamentId,
        round,
      } = req.body;

      const result =
        await pairingService.deleteTeamPairings({
          tournamentId,
          round,
        });

      res.json({
        success: true,
        message:
          "Team pairings deleted successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "DELETE TEAM PAIRINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;