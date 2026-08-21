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


module.exports = router;