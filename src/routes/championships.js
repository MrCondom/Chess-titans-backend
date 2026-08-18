Championship.js
const express = require("express");

const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const playerAuth = require("../middleware/playerAuth");

const championshipService = require("../services/championshipService");


/*
 * GET /championships
 *
 * Public/player-accessible list.
 */
router.get("/", async (req, res) => {
  try {
    const result =
      await championshipService.getChampionships({
        page: req.query.page,
        limit: req.query.limit,
        status: req.query.status || null,
      });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
});


/*
 * GET /championships/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const championship =
      await championshipService.getChampionship(
        req.params.id
      );

    res.json({
      success: true,
      championship,
    });
  } catch (error) {
    console.error(error);

    const status =
      error.code === "CHAMPIONSHIP_NOT_FOUND"
        ? 404
        : 400;

    res.status(status).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
});


/*
 * ADMIN
 *
 * POST /championships
 */
router.post("/", adminAuth, async (req, res) => {
  try {
    const championship =
      await championshipService.createChampionship({
        name: req.body.name,
      });

    res.status(201).json({
      success: true,
      championship,
    });
  } catch (error) {
    console.error(error);

    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
});


/*
 * ADMIN
 *
 * POST /championships/:id/players
 */
router.post(
  "/:id/players",
  adminAuth,
  async (req, res) => {
    try {
      const participant =
        await championshipService.addPlayer(
          req.params.id,
          req.body.playerId
        );

      res.status(201).json({
        success: true,
        participant,
      });
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


/*
 * ADMIN
 *
 * DELETE /championships/:id/players/:playerId
 */
router.delete(
  "/:id/players/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await championshipService.removePlayer(
          req.params.id,
          req.params.playerId
        );

      res.json(result);
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


/*
 * ADMIN
 *
 * POST /championships/:id/start
 */
router.post(
  "/:id/start",
  adminAuth,
  async (req, res) => {
    try {
      const championship =
        await championshipService.startChampionship(
          req.params.id
        );

      res.json({
        success: true,
        championship,
      });
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


/*
 * ADMIN
 *
 * PATCH /championships/:id/players/:playerId
 */
router.patch(
  "/:id/players/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const participant =
        await championshipService.updateParticipant(
          req.params.id,
          req.params.playerId,
          {
            totalPoints: req.body.totalPoints,
            totalRounds: req.body.totalRounds,
            accuracy: req.body.accuracy,
          }
        );

      res.json({
        success: true,
        participant,
      });
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


/*
 * ADMIN
 *
 * POST /championships/:id/complete
 */
router.post(
  "/:id/complete",
  adminAuth,
  async (req, res) => {
    try {
      const championship =
        await championshipService.completeChampionship(
          req.params.id,
          {
            championTitle:
              req.body.championTitle,
          }
        );

      res.json({
        success: true,
        championship,
      });
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


/*
 * ADMIN
 *
 * POST /championships/:id/cancel
 */
router.post(
  "/:id/cancel",
  adminAuth,
  async (req, res) => {
    try {
      const championship =
        await championshipService.cancelChampionship(
          req.params.id
        );

      res.json({
        success: true,
        championship,
      });
    } catch (error) {
      console.error(error);

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
  }
);


module.exports = router;

