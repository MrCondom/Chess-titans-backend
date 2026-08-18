const express = require("express");

const router = express.Router();

const rankingService = require("../services/rankingService");

const playerAuth = require("../middleware/playerAuth");
const adminAuth = require("../middleware/adminAuth");



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


/**
 * GET MY RANKING
 *
 * Authenticated player only.
 *
 * GET /api/rankings/me?category=Open&mode=RAPID
 */
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


/**
 * GET PLAYER RANKING
 *
 * Authenticated player.
 *
 * A player can inspect another player's
 * public ranking.
 */
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


/**
 * ADMIN: RECALCULATE RANKINGS
 *
 * POST
 * /api/rankings/recalculate
 *
 * Body:
 *
 * {
 *   "category": "Open",
 *   "mode": "RAPID"
 * }
 */
router.post(
  "/recalculate",
  adminAuth,
  async (req, res) => {
    try {
      const {
        category,
        mode,
      } = req.body;

      const rankings =
        await rankingService.calculateRankings({
          category,
          mode,
        });

      res.json({
        success: true,
        message:
          "Rankings recalculated successfully.",
        count: rankings.length,
        rankings,
      });

    } catch (error) {
      console.error(
        "RECALCULATE RANKINGS ERROR:",
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
