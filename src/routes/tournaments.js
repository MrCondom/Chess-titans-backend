const express = require("express");
const router = express.Router();

const specialTournamentService =
  require("../services/tournamentService");

const {
  adminAuth,
} = require("../middleware/adminAuth");

const playerAuth =
  require("../middleware/playerAuth");


router.post("/", adminAuth, async (req, res) => {
  try {
    const {
      name,
      mode,
      format,
      totalRounds,
      roundDurationMinutes,
      startedAt,
    } = req.body;

    const tournament =
      await specialTournamentService.createSpecialTournament({
        name,
        mode,
        format,
        totalRounds,
        roundDurationMinutes,
        startedAt,
      });

    return res.status(201).json({
      success: true,
      message: "Special tournament created successfully.",
      tournament,
    });

  } catch (error) {
    console.error(
      "[SPECIAL TOURNAMENT CREATE ERROR]",
      error
    );

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message ||
        "Failed to create special tournament.",
    });
  }
});


router.get(
  "/active-players",
  adminAuth,
  async (req, res) => {
    try {
      const players =
        await specialTournamentService.getActivePlayers();

      return res.json({
        success: true,
        count: players.length,
        players,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT ACTIVE PLAYERS ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to get active players.",
      });
    }
  }
);


router.get(
  "/:tournamentId",
  async (req, res) => {
    try {
      const tournament =
        await specialTournamentService.getSpecialTournament(
          req.params.tournamentId
        );

      return res.json({
        success: true,
        tournament,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT GET ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to get special tournament.",
      });
    }
  }
);


router.post(
  "/:tournamentId/join",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = req.playerId;

      const participant =
        await specialTournamentService.joinSpecialTournament(
          req.params.tournamentId,
          playerId
        );

      return res.status(201).json({
        success: true,
        message:
          "You joined the special tournament.",
        participant,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT JOIN ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to join special tournament.",
      });
    }
  }
);

router.delete(
  "/:tournamentId/leave",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = req.playerId;

      const result =
        await specialTournamentService.leaveSpecialTournament(
          req.params.tournamentId,
          playerId
        );

      return res.json(result);

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT LEAVE ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to leave special tournament.",
      });
    }
  }
);


router.get(
  "/:tournamentId/participants",
  async (req, res) => {
    try {
      const participants =
        await specialTournamentService
          .getTournamentParticipants(
            req.params.tournamentId
          );

      return res.json({
        success: true,
        count: participants.length,
        participants,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT PARTICIPANTS ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to get tournament participants.",
      });
    }
  }
);


router.post(
  "/:tournamentId/generate-pairings",
  adminAuth,
  async (req, res) => {
    try {
      const tournament =
        await specialTournamentService
          .generateSpecialTournamentPairings(
            req.params.tournamentId
          );

      return res.json({
        success: true,
        message:
          "Special tournament pairings generated successfully.",
        tournament,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT GENERATE PAIRINGS ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to generate special tournament pairings.",
      });
    }
  }
);


router.get(
  "/:tournamentId/pairings",
  async (req, res) => {
    try {
      const pairings =
        await specialTournamentService
          .getSpecialTournamentPairings(
            req.params.tournamentId,
            req.query.round
          );

      return res.json({
        success: true,
        count: pairings.length,
        pairings,
      });

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT PAIRINGS ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to get special tournament pairings.",
      });
    }
  }
);


router.delete(
  "/:tournamentId/pairings",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await specialTournamentService
          .deleteSpecialTournamentPairings(
            req.params.tournamentId
          );

      return res.json(result);

    } catch (error) {
      console.error(
        "[SPECIAL TOURNAMENT DELETE PAIRINGS ERROR]",
        error
      );

      return res.status(error.statusCode || 500).json({
        success: false,
        message:
          error.message ||
          "Failed to delete special tournament pairings.",
      });
    }
  }
);

router.get("/", async (req, res) => {
  try {
    const tournaments =
      await specialTournamentService.getAllSpecialTournaments();

    return res.json({
      success: true,
      tournaments,
    });
  } catch (error) {
    console.error(
      "GET SPECIAL TOURNAMENTS ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to load special tournaments.",
    });
  }
});

module.exports = router;
