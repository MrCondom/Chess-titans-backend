const express = require("express");

const router = express.Router();

const pairingService =
  require("../services/pairingService");


// ======================================================
// PAIRING OPTIONS
// ======================================================

// GET /pairings/categories?tournamentId=1
router.get(
  "/categories",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .getAvailableCategories({
            tournamentId:
              req.query.tournamentId,
          });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// GET /pairings/teams?tournamentId=1
router.get(
  "/teams",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .getAvailableTeams({
            tournamentId:
              req.query.tournamentId,
          });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// ======================================================
// INDIVIDUAL
// ======================================================

// POST /pairings/generate
router.post(
  "/generate",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .generatePairings({
            tournamentId:
              req.body.tournamentId,

            category:
              req.body.category,

            rounds:
              req.body.rounds,

            hoursPerRound:
              req.body.hoursPerRound,

            availableAt:
              req.body.availableAt,
          });

      res.status(201).json({
        success: true,
        message:
          "Individual pairings generated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// GET /pairings?tournamentId=1&category=HEAVYWEIGHT&round=1
router.get(
  "/",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .getPairings({
            tournamentId:
              req.query.tournamentId,

            category:
              req.query.category,

            round:
              req.query.round,
          });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// DELETE /pairings
router.delete(
  "/",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .deletePairings({
            tournamentId:
              req.body.tournamentId,

            round:
              req.body.round,

            category:
              req.body.category,
          });

      res.json({
        success: true,
        message:
          "Pairings deleted successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// ======================================================
// TEAM VS TEAM
// ======================================================

// POST /pairings/team/generate
router.post(
  "/team/generate",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .generateTeamPairings({
            tournamentId:
              req.body.tournamentId,

            rounds:
              req.body.rounds,

            hoursPerRound:
              req.body.hoursPerRound,

            availableAt:
              req.body.availableAt,
          });

      res.status(201).json({
        success: true,
        message:
          "Team pairings generated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// GET /pairings/team?tournamentId=1&round=1
router.get(
  "/team",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .getTeamPairings({
            tournamentId:
              req.query.tournamentId,

            round:
              req.query.round,
          });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// ======================================================
// TEAM BOARD
// ======================================================

// POST /pairings/team-table/generate
router.post(
  "/team-table/generate",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .generateTeamTablePairings({
            teamPairingId:
              req.body.teamPairingId,
          });

      res.status(201).json({
        success: true,
        message:
          "Team board pairings generated successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// GET /pairings/team-table/:teamPairingId
router.get(
  "/team-table/:teamPairingId",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .getTeamTablePairings({
            teamPairingId:
              req.params.teamPairingId,
          });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


// ======================================================
// DELETE TEAM PAIRINGS
// ======================================================

// DELETE /pairings/team
router.delete(
  "/team",
  async (req, res, next) => {
    try {
      const result =
        await pairingService
          .deleteTeamPairings({
            tournamentId:
              req.body.tournamentId,

            round:
              req.body.round,
          });

      res.json({
        success: true,
        message:
          "Team pairings deleted successfully.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);


module.exports = router;