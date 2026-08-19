const express = require("express");

const router = express.Router();

const tournamentService = require("../services/tournamentService");

const playerAuth = require("../middleware/playerAuth");
const adminAuth = require("../middleware/adminAuth");



router.get(
  "/",
  async (req, res) => {
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

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "GET TOURNAMENTS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.get(
  "/:id",
  async (req, res) => {
    try {
      const tournament =
        await tournamentService.getTournamentById(
          req.params.id
        );

      return res.json({
        success: true,
        tournament,
      });
    } catch (error) {
      console.error(
        "GET TOURNAMENT ERROR:",
        error
      );

      const status =
        error.code ===
        "TOURNAMENT_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);

router.get(
  "/:id/standings",
  async (req, res) => {
    try {
      const standings =
        await tournamentService.getStandings(
          req.params.id
        );

      return res.json({
        success: true,
        standings,
      });
    } catch (error) {
      console.error(
        "GET TOURNAMENT STANDINGS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.get(
  "/player/:playerId",
  async (req, res) => {
    try {
      const result =
        await tournamentService.getPlayerTournaments(
          req.params.playerId,
          {
            page: req.query.page,
            limit: req.query.limit,
          }
        );

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "GET PLAYER TOURNAMENTS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);

router.post(
  "/",
  adminAuth,
  async (req, res) => {
    try {
      const {
        name,
        category,
        mode,
        type,
      } = req.body;

      const tournament =
        await tournamentService.createTournament({
          name,
          category,
          mode,
          type,
        });

      return res.status(201).json({
        success: true,
        message:
          "Tournament created successfully.",
        tournament,
      });
    } catch (error) {
      console.error(
        "CREATE TOURNAMENT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.post(
  "/:id/start",
  adminAuth,
  async (req, res) => {
    try {
      const tournament =
        await tournamentService.startTournament(
          req.params.id
        );

      return res.json({
        success: true,
        message:
          "Tournament started successfully.",
        tournament,
      });
    } catch (error) {
      console.error(
        "START TOURNAMENT ERROR:",
        error
      );

      return res.status(400).json({
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
      const {
        playerId,
      } = req.body;

      const participant =
        await tournamentService.registerPlayer(
          req.params.id,
          playerId
        );

      return res.status(201).json({
        success: true,
        message:
          "Player registered for tournament.",
        participant,
      });
    } catch (error) {
      console.error(
        "REGISTER TOURNAMENT PLAYER ERROR:",
        error
      );

      return res.status(400).json({
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
      const result =
        await tournamentService.removePlayer(
          req.params.id,
          req.params.playerId
        );

      return res.json({
        success: true,
        message:
          "Player removed from tournament.",
        result,
      });
    } catch (error) {
      console.error(
        "REMOVE TOURNAMENT PLAYER ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.patch(
  "/:id/players/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const {
        totalPoints,
        totalRounds,
        accuracy,
        ratingBefore,
        ratingAfter,
      } = req.body;

      const result =
        await tournamentService.updateTournamentResult({
          tournamentId:
            req.params.id,

          playerId:
            req.params.playerId,

          totalPoints,
          totalRounds,
          accuracy,
          ratingBefore,
          ratingAfter,
        });

      return res.json({
        success: true,
        message:
          "Tournament result updated.",
        result,
      });
    } catch (error) {
      console.error(
        "UPDATE TOURNAMENT RESULT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


router.post(
  "/:id/standings/save",
  adminAuth,
  async (req, res) => {
    try {
      const standings =
        await tournamentService.saveStandings(
          req.params.id
        );

      return res.json({
        success: true,
        message:
          "Tournament standings saved.",
        standings,
      });
    } catch (error) {
      console.error(
        "SAVE TOURNAMENT STANDINGS ERROR:",
        error
      );

      return res.status(400).json({
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

      return res.json({
        success: true,
        message:
          "Tournament completed successfully.",
        ...result,
      });
    } catch (error) {
      console.error(
        "COMPLETE TOURNAMENT ERROR:",
        error
      );

      return res.status(400).json({
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

      return res.json({
        success: true,
        message:
          "Tournament cancelled successfully.",
        tournament,
      });
    } catch (error) {
      console.error(
        "CANCEL TOURNAMENT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "TOURNAMENT_ERROR",
      });
    }
  }
);


module.exports = router;

