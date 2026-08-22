const express = require("express");
const router = express.Router();

const tournamentService =
  require("../services/tournamentService");

router.post("/:tournamentId/table", async (req, res) => {
  try {
    const { tournamentId } = req.params;

    const standings =
      await tournamentService.recordTournamentTable(
        tournamentId
      );

    res.status(200).json({
      success: true,
      message: "Tournament table recorded successfully.",
      standings,
    });
  } catch (error) {
    console.error(
      "RECORD TOURNAMENT TABLE ERROR:",
      error
    );

    if (
      [
        "TOURNAMENT_NOT_FOUND",
        "FINAL_ROUND_NOT_CREATED",
        "FINAL_ROUND_INCOMPLETE",
      ].includes(error.code)
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to record tournament table.",
    });
  }
});

router.post(
  "/:tournamentId/declare-winner",
  async (req, res) => {
    try {
      const { tournamentId } = req.params;

      const result =
        await tournamentService.declareTournamentWinner(
          tournamentId
        );

      res.status(200).json({
        success: true,
        message:
          "Tournament winner declared successfully.",
        ...result,
      });
    } catch (error) {
      console.error(
        "DECLARE TOURNAMENT WINNER ERROR:",
        error
      );

      if (
        [
          "TOURNAMENT_NOT_FOUND",
          "FINAL_ROUND_NOT_CREATED",
          "FINAL_ROUND_INCOMPLETE",
          "TOURNAMENT_TABLE_NOT_RECORDED",
        ].includes(error.code)
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to declare tournament winner.",
      });
    }
  }
);
router.post(
  "/:tournamentId/team-table",
  async (req, res) => {
    try {
      const standings =
        await tournamentService.recordTeamTournamentTable(
          req.params.tournamentId
        );

      return res.status(200).json({
        success: true,
        message:
          "Team tournament table recorded successfully.",
        standings,
      });
    } catch (error) {
      console.error(
        "RECORD TEAM TOURNAMENT TABLE ERROR:",
        error
      );

      const clientErrors = [
        "INVALID_TOURNAMENT_ID",
        "TOURNAMENT_NOT_FOUND",
        "NOT_TEAM_TOURNAMENT",
        "INVALID_TEAM_TOURNAMENT_FORMAT",
        "INVALID_TOTAL_ROUNDS",
        "TEAM_PAIRINGS_NOT_CREATED",
        "FINAL_ROUND_NOT_CREATED",
        "FINAL_ROUND_INCOMPLETE",
        "TOURNAMENT_INCOMPLETE",
        "TEAM_GAMES_NOT_FOUND",
        "TEAM_NOT_FOUND",
        "INVALID_TEAM_PAIRING",
      ];

      if (clientErrors.includes(error.code)) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to record team tournament table.",
      });
    }
  }
);


module.exports = router