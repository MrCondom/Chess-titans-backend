const express = require("express");

const router = express.Router();

const rankingService = require("../services/rankingService");

const playerAuth = require("../middleware/playerAuth");




router.get("/", async (req, res) => {
  try {
    const {
      category,
      mode,
    } = req.query;

    const rankings =
      await rankingService.getRankings({
        category,
        mode,
      });

    res.json({
      success: true,
      count: rankings.length,
      rankings,
    });

  } catch (error) {
    console.error(
      "GET RANKINGS ERROR:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});


router.get(
  "/me",
  playerAuth,
  async (req, res) => {
    try {
      const {
        category,
        mode,
      } = req.query;

      const playerId =
        req.player.id;

      const ranking =
        await rankingService.getPlayerRanking({
          playerId,
          category,
          mode,
        });

      if (!ranking) {
        return res.status(404).json({
          success: false,
          message:
            "Ranking not found.",
        });
      }

      res.json({
        success: true,
        ranking,
      });

    } catch (error) {
      console.error(
        "GET MY RANKING ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);


router.get(
  "/player/:playerId",
  playerAuth,
  async (req, res) => {
    try {
      const {
        category,
        mode,
      } = req.query;

      const ranking =
        await rankingService.getPlayerRanking({
          playerId: req.params.playerId,
          category,
          mode,
        });

      if (!ranking) {
        return res.status(404).json({
          success: false,
          message:
            "Ranking not found.",
        });
      }

      res.json({
        success: true,
        ranking,
      });

    } catch (error) {
      console.error(
        "GET PLAYER RANKING ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.get(
  "/overall",
  async (req, res) => {
    try {
      const rankings =
        await rankingService.getOverallPlayerRankings();

      res.json({
        success: true,
        count: rankings.length,
        rankings,
      });

    } catch (error) {
      console.error(
        "GET OVERALL PLAYER RANKINGS ERROR:",
        error
      );

      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.get(
  "/teams",
  async (req, res) => {
    try {
      const rankings =
        await rankingService.getTeamRankings();

      res.json({
        success: true,
        count: rankings.length,
        rankings,
      });

    } catch (error) {
      console.error(
        "GET TEAM RANKINGS ERROR:",
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
