const express = require("express");
const router = express.Router();

const pairingService =
  require("../services/pairingService");


// ======================================================
// GET AVAILABLE PAIRING CATEGORIES
// ======================================================

router.get(
  "/categories",
  async (req, res) => {
    try {
      console.log(
        "🔥 GET /pairings/categories"
      );

      const result =
        await pairingService.getAvailableCategories();

      return res.status(200).json({
        success: true,
        data: result,
      });

    } catch (error) {
      console.error(
        "GET PAIRING CATEGORIES ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to load pairing categories.",

        code:
          error.code ||
          "PAIRING_ERROR",
      });
    }
  }
);


// ======================================================
// GET ACTIVE PLAYERS FOR A CATEGORY
// ======================================================

router.get(
  "/players",
  async (req, res) => {
    try {
      const {
        category,
      } = req.query;

      console.log(
        "🔥 GET /pairings/players:",
        {
          category,
        }
      );

      const players =
        await pairingService.getPairingPlayers(
          category
        );

      return res.status(200).json({
        success: true,

        data: {
          category:
            String(category)
              .trim()
              .toUpperCase(),

          players,
        },
      });

    } catch (error) {
      console.error(
        "GET PAIRING PLAYERS ERROR:",
        error
      );

      const status =
        error.code ===
        "CATEGORY_REQUIRED"
          ? 400
          : error.code ===
            "NOT_ENOUGH_PLAYERS"
            ? 400
            : 500;

      return res.status(status).json({
        success: false,

        message:
          error.message ||
          "Failed to load pairing players.",

        code:
          error.code ||
          "PAIRING_ERROR",
      });
    }
  }
);


// ======================================================
// GENERATE AND SAVE PAIRINGS
// ======================================================

router.post(
  "/generate",
  async (req, res) => {
    try {
      const {
        category,
        rounds,
        hoursPerRound,
        availableAt,
        format,
        mode,
      } = req.body;

      console.log(
        "🔥 POST /pairings/generate:",
        {
          category,
          rounds,
          hoursPerRound,
          availableAt,
          format,
          mode,
        }
      );

      const result =
        await pairingService.generatePairings({
          category,
          rounds,
          hoursPerRound,
          availableAt,
          format,
          mode,
        });

      return res.status(200).json({
        success: true,

        message:
          "Pairings generated and saved successfully.",

        data: result,
      });

    } catch (error) {
      console.error(
        "GENERATE PAIRINGS ERROR:",
        error
      );

      const statusCodes = {
        CATEGORY_REQUIRED: 400,
        INVALID_TOTAL_ROUNDS: 400,
        INVALID_ROUND_INTERVAL: 400,
        INVALID_DATE: 400,
        INVALID_FORMAT: 400,
        INVALID_MODE: 400,
        INVALID_ROUND: 400,
        ROUND_LIMIT: 400,
        NOT_ENOUGH_PLAYERS: 400,
        NO_PAIRINGS: 400,
      };

      return res
        .status(
          statusCodes[error.code] || 500
        )
        .json({
          success: false,

          message:
            error.message ||
            "Failed to generate pairings.",

          code:
            error.code ||
            "PAIRING_ERROR",
        });
    }
  }
);


// ======================================================
// GET PAIRINGS
// ======================================================

router.get(
  "/",
  async (req, res) => {
    try {
      const {
        round,
        category,
        mode,
      } = req.query;

      console.log(
        "🔥 GET /pairings:",
        {
          round,
          category,
          mode,
        }
      );

      const result =
        await pairingService.getPairings({
          round,
          category,
          mode,
        });

      return res.status(200).json({
        success: true,

        data: result,
      });

    } catch (error) {
      console.error(
        "GET PAIRINGS ERROR:",
        error
      );

      const statusCodes = {
        INVALID_ROUND: 400,
        INVALID_MODE: 400,
        ROUND_LIMIT: 400,
      };

      return res
        .status(
          statusCodes[error.code] || 500
        )
        .json({
          success: false,

          message:
            error.message ||
            "Failed to load pairings.",

          code:
            error.code ||
            "PAIRING_ERROR",
        });
    }
  }
);


// ======================================================
// DELETE PAIRINGS
// ======================================================

router.delete(
  "/",
  async (req, res) => {
    try {
      const {
        round,
        category,
        mode,
      } = req.query;

      console.log(
        "🔥 DELETE /pairings:",
        {
          round,
          category,
          mode,
        }
      );

      const result =
        await pairingService.deletePairings({
          round,
          category,
          mode,
        });

      return res.status(200).json({
        success: true,

        message:
          "Pairings deleted successfully.",

        data: result,
      });

    } catch (error) {
      console.error(
        "DELETE PAIRINGS ERROR:",
        error
      );

      const statusCodes = {
        INVALID_ROUND: 400,
        INVALID_MODE: 400,
        ROUND_LIMIT: 400,
        PAIRINGS_NOT_FOUND: 404,
      };

      return res
        .status(
          statusCodes[error.code] || 500
        )
        .json({
          success: false,

          message:
            error.message ||
            "Failed to delete pairings.",

          code:
            error.code ||
            "PAIRING_ERROR",
        });
    }
  }
);

// ======================================================
// GENERATE TEAM PAIRING
// ======================================================

router.post(
  "/team/generate",
  async (req, res) => {

    try {

      const {
        teamAId,
        teamBId,
        rounds,
        hoursPerRound,
        availableAt,
        mode,
      } = req.body;


      console.log(
        "🔥 POST /pairings/team/generate:",
        {
          teamAId,
          teamBId,
          rounds,
          hoursPerRound,
          availableAt,
          mode,
        }
      );


      const result =
        await pairingService.generateTeamPairings({

          teamAId,

          teamBId,

          rounds,

          hoursPerRound,

          availableAt,

          mode,

        });


      return res.status(200).json({

        success: true,

        message:
          "Team pairings generated and saved successfully.",

        data:
          result,

      });


    } catch (error) {

      console.error(
        "GENERATE TEAM PAIRINGS ERROR:",
        error
      );


      const statusCodes = {

        INVALID_TEAM_ID: 400,

        TEAM_NOT_FOUND: 404,

        SAME_TEAM: 400,

        MODE_REQUIRED: 400,

        INVALID_MODE: 400,

        INVALID_TOTAL_ROUNDS: 400,

        INVALID_ROUND_INTERVAL: 400,

        INVALID_DATE: 400,

        ROUND_LIMIT: 400,

        TEAM_A_NO_PLAYERS: 400,

        TEAM_B_NO_PLAYERS: 400,

        NOT_ENOUGH_PLAYERS: 400,

      };


      return res.status(
        statusCodes[error.code] || 500
      ).json({

        success: false,

        message:
          error.message ||
          "Failed to generate team pairings.",

        code:
          error.code ||
          "TEAM_PAIRING_ERROR",

      });

    }

  }
);


// ======================================================
// GENERATE BOARD-TO-BOARD PAIRINGS
// ======================================================

router.post(
  "/team/board/generate",
  async (req, res) => {

    try {

      const {
        teamPairingId,
      } = req.body;


      console.log(
        "🔥 POST /pairings/team/board/generate:",
        {
          teamPairingId,
        }
      );


      const result =
        await pairingService.generateBoardPairings({

          teamPairingId,

        });


      return res.status(200).json({

        success: true,

        message:
          "Board-to-board pairings generated and saved successfully.",

        data:
          result,

      });


    } catch (error) {

      console.error(
        "GENERATE BOARD PAIRINGS ERROR:",
        error
      );


      const statusCodes = {

        INVALID_TEAM_PAIRING_ID: 400,

        TEAM_PAIRING_NOT_FOUND: 404,

        NOT_ENOUGH_PLAYERS: 400,

      };


      return res.status(
        statusCodes[error.code] || 500
      ).json({

        success: false,

        message:
          error.message ||
          "Failed to generate board pairings.",

        code:
          error.code ||
          "BOARD_PAIRING_ERROR",

      });

    }

  }
);


// ======================================================
// GET TEAM PAIRINGS
// ======================================================

router.get(
  "/team",
  async (req, res) => {

    try {

      const {
        teamId,
        round,
        mode,
      } = req.query;


      console.log(
        "🔥 GET /pairings/team:",
        {
          teamId,
          round,
          mode,
        }
      );


      const result =
        await pairingService.getTeamPairings({

          teamId,

          round,

          mode,

        });


      return res.status(200).json({

        success: true,

        data:
          result,

      });


    } catch (error) {

      console.error(
        "GET TEAM PAIRINGS ERROR:",
        error
      );


      const statusCodes = {

        INVALID_TEAM_ID: 400,

        INVALID_ROUND: 400,

        ROUND_LIMIT: 400,

        MODE_REQUIRED: 400,

        INVALID_MODE: 400,

      };


      return res.status(
        statusCodes[error.code] || 500
      ).json({

        success: false,

        message:
          error.message ||
          "Failed to load team pairings.",

        code:
          error.code ||
          "TEAM_PAIRING_ERROR",

      });

    }

  }
);


// ======================================================
// DELETE TEAM PAIRINGS
// ======================================================

router.delete(
  "/team",
  async (req, res) => {

    try {

      const {
        teamId,
        round,
        mode,
      } = req.query;


      console.log(
        "🔥 DELETE /pairings/team:",
        {
          teamId,
          round,
          mode,
        }
      );


      const result =
        await pairingService.deleteTeamPairings({

          teamId,

          round,

          mode,

        });


      return res.status(200).json({

        success: true,

        message:
          "Team pairings deleted successfully.",

        data:
          result,

      });


    } catch (error) {

      console.error(
        "DELETE TEAM PAIRINGS ERROR:",
        error
      );


      const statusCodes = {

        INVALID_TEAM_ID: 400,

        INVALID_ROUND: 400,

        ROUND_LIMIT: 400,

        MODE_REQUIRED: 400,

        INVALID_MODE: 400,

        TEAM_PAIRINGS_NOT_FOUND: 404,

      };


      return res.status(
        statusCodes[error.code] || 500
      ).json({

        success: false,

        message:
          error.message ||
          "Failed to delete team pairings.",

        code:
          error.code ||
          "TEAM_PAIRING_ERROR",

      });

    }

  }
);


module.exports = router;

