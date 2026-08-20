const express = require("express");
const router = express.Router();

const tournamentService = require("../services/tournamentService");
const adminAuth = require("../middleware/adminAuth");


router.get("/", async (req, res) => {
  try {
    const result =
      await tournamentService.getTournaments({
        status: req.query.status,
        mode: req.query.mode,
        type: req.query.type,
        category: req.query.category,
        page: req.query.page,
        limit: req.query.limit,
      });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("GET TOURNAMENTS:", error);

    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code || "TOURNAMENT_ERROR",
    });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const tournament =
      await tournamentService.getTournamentById(
        req.params.id
      );

    res.json({
      success: true,
      tournament,
    });
  } catch (error) {
    res.status(
      error.code === "TOURNAMENT_NOT_FOUND"
        ? 404
        : 400
    ).json({
      success: false,
      message: error.message,
      code: error.code || "TOURNAMENT_ERROR",
    });
  }
});


router.get("/:id/standings", async (req, res) => {
  try {
    const standings =
      await tournamentService.calculateStandings(
        req.params.id
      );

    res.json({
      success: true,
      standings,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code || "TOURNAMENT_ERROR",
    });
  }
});


router.get("/player/:playerId", async (req, res) => {
  try {
    const result =
      await tournamentService.getPlayerTournaments(
        req.params.playerId,
        {
          page: req.query.page,
          limit: req.query.limit,
        }
      );

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code || "TOURNAMENT_ERROR",
    });
  }
});


router.post("/", adminAuth, async (req, res) => {
  try {
    const tournament =
      await tournamentService.createTournament(
        req.body
      );

    res.status(201).json({
      success: true,
      message: "Tournament created successfully.",
      tournament,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
      code: error.code || "TOURNAMENT_ERROR",
    });
  }
});


router.post(
  "/:id/start",
  adminAuth,
  async (req, res) => {
    try {
      const tournament =
        await tournamentService.startTournament(
          req.params.id
        );

      res.json({
        success: true,
        message: "Tournament started successfully.",
        tournament,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.post(
  "/:id/players",
  adminAuth,
  async (req, res) => {
    try {
      const participant =
        await tournamentService.registerPlayer(
          req.params.id,
          req.body.playerId
        );

      res.status(201).json({
        success: true,
        message: "Player registered for tournament.",
        participant,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.delete(
  "/:id/players/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      await tournamentService.removePlayer(
        req.params.id,
        req.params.playerId
      );

      res.json({
        success: true,
        message: "Player removed from tournament.",
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.post(
  "/:id/complete",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await tournamentService.completeTournament(
          req.params.id
        );

      res.json({
        success: true,
        message: "Tournament completed successfully.",
        ...result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.post(
  "/:id/cancel",
  adminAuth,
  async (req, res) => {
    try {
      const tournament =
        await tournamentService.cancelTournament(
          req.params.id
        );

      res.json({
        success: true,
        message: "Tournament cancelled successfully.",
        tournament,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


module.exports = router;
