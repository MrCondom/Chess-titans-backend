const express = require("express");

const router = express.Router();

const resultService =
  require("../services/resultService");

const playerAuth =
  require("../middleware/playerAuth");

const resultAuth =
  require("../middleware/resultAuth");

const {
  adminAuth,
} = require("../middleware/adminAuth");


router.post(
  "/pairings/:pairingId",
  playerAuth,
  async (req, res) => {
    try {
      const {
        pairingId,
      } = req.params;

      const {
        whiteScore,
        blackScore,
      } = req.body;

      const result =
        await resultService.createResult({
          pairingId,
          whiteScore,
          blackScore,
        });

      return res.status(201).json({
        success: true,
        message:
          "Result submitted successfully. It is now awaiting approval.",
        result,
      });

    } catch (error) {
      console.error(
        "[RECORD RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "PAIRING_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "RESULT_ALREADY_EXISTS"
      ) {
        statusCode = 409;
      }

      if (
        error.code ===
          "INVALID_ID" ||
        error.code ===
          "INVALID_SCORE" ||
        error.code ===
          "INVALID_RESULT_SCORE" ||
        error.code ===
          "INVALID_PAIRING"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to record result.",
        code: error.code,
      });
    }
  }
);

// ======================================================
// ADMIN CREATE RESULT
// ======================================================

router.post(
  "/admin/pairings/:pairingId",
  adminAuth,
  async (req, res) => {
    try {
      const { pairingId } = req.params;
      const { whiteScore, blackScore } = req.body;

      const result =
        await resultService.createResult({
          pairingId,
          whiteScore,
          blackScore,
        });

      return res.status(201).json({
        success: true,
        message:
          "Result created successfully by administrator.",
        result,
      });

    } catch (error) {
      console.error(
        "[ADMIN CREATE RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code === "PAIRING_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code === "RESULT_ALREADY_EXISTS"
      ) {
        statusCode = 409;
      }

      if (
        error.code === "INVALID_ID" ||
        error.code === "INVALID_SCORE" ||
        error.code === "INVALID_RESULT_SCORE" ||
        error.code === "INVALID_PAIRING"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to create result.",
        code: error.code,
      });
    }
  }
);

router.put(
  "/:resultId",
  resultAuth,
  async (req, res) => {
    try {
      const {
        resultId,
      } = req.params;

      const {
        whiteScore,
        blackScore,
      } = req.body;

     
      const isAdmin =
        Boolean(req.isAdmin);


      const result =
        await resultService.updateResult({
          resultId,
          whiteScore,
          blackScore,
          isAdmin,
        });

      return res.json({
        success: true,
        message:
          "Result updated successfully.",
        result,
      });

    } catch (error) {
      console.error(
        "[UPDATE RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "RESULT_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "RESULT_APPROVED_ADMIN_ONLY"
      ) {
        statusCode = 403;
      }

      if (
        error.code ===
        "RESULT_RATING_ALREADY_APPLIED"
      ) {
        statusCode = 409;
      }

      if (
        error.code ===
          "INVALID_ID" ||
        error.code ===
          "INVALID_SCORE" ||
        error.code ===
          "INVALID_RESULT_SCORE"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to update result.",
        code: error.code,
      });
    }
  }
);

router.put(
  "/admin/:resultId",
  adminAuth,
  async (req, res) => {
    try {
      const {
        resultId,
      } = req.params;

      const {
        whiteScore,
        blackScore,
      } = req.body;

      const updatedResult =
        await resultService.updateResult({
          resultId,
          whiteScore,
          blackScore,
          isAdmin: true,
        });
      
      if (
        updatedResult &&
        updatedResult.result &&
        Array.isArray(
          updatedResult.ratingGains
        )
      ) {
        return res.json({
          success: true,

          message:
            "Result updated successfully by administrator.",

          result:
            updatedResult.result,

          ratingGains:
            updatedResult.ratingGains,
        });
      }

      /*
       * New or rejected result edits do not
       * generate rating gains yet.
       */
      return res.json({
        success: true,

        message:
          "Result updated successfully by administrator.",

        result: updatedResult,

        ratingGains: [],
      });

    } catch (error) {
      console.error(
        "[ADMIN UPDATE RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "RESULT_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "RESULT_RATING_ALREADY_APPLIED"
      ) {
        statusCode = 409;
      }

      if (
        error.code ===
          "INVALID_ID" ||
        error.code ===
          "INVALID_SCORE" ||
        error.code ===
          "INVALID_RESULT_SCORE"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,

        message:
          error.message ||
          "Failed to update result.",

        code:
          error.code ||
          "UPDATE_RESULT_ERROR",
      });
    }
  }
);

router.delete(
  "/:resultId",
  adminAuth,
  async (req, res) => {
    try {
      const {
        resultId,
      } = req.params;

      const result =
        await resultService.deleteResult({
          resultId,
          isAdmin: true,
        });

      return res.json(result);

    } catch (error) {
      console.error(
        "[DELETE RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "RESULT_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "RESULT_RATING_ALREADY_APPLIED"
      ) {
        statusCode = 409;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to delete result.",
        code: error.code,
      });
    }
  }
);

// ======================================================
// GET ALL GAMES FOR RESULT RECORDING
// ======================================================

router.get(
  "/pairings",
  async (req, res) => {
    try {

      const pairings =
        await resultService.getResultPairings();

      return res.status(200).json({
        success: true,
        pairings,
        count: pairings.length,
      });

    } catch (error) {

      console.error(
        "GET RESULT PAIRINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to load result pairings.",

        code:
          error.code ||
          "RESULT_PAIRINGS_ERROR",
      });
    }
  }
);

// ======================================================
// CREATE TEAM GAME RESULT
// ======================================================

router.post(
  "/team-games/:teamGameId",
  playerAuth,
  async (req, res) => {
    try {
      const {
        teamGameId,
      } = req.params;

      const {
        result,
      } = req.body;

      const teamGameResult =
        await resultService.createTeamGameResult({
          teamGameId,
          result,
        });

      return res.status(201).json({
        success: true,

        message:
          "Team game result submitted successfully. It is now awaiting approval.",

        result: teamGameResult,
      });

    } catch (error) {

      console.error(
        "[CREATE TEAM GAME RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "TEAM_GAME_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "TEAM_RESULT_ALREADY_EXISTS"
      ) {
        statusCode = 409;
      }

      if (
        error.code ===
          "INVALID_ID" ||
        error.code ===
          "INVALID_TEAM_RESULT" ||
        error.code ===
          "INVALID_TEAM_GAME"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,

        message:
          error.message ||
          "Failed to record team game result.",

        code:
          error.code ||
          "TEAM_RESULT_ERROR",
      });
    }
  }
);

// ======================================================
// UPDATE TEAM GAME RESULT
// ======================================================

router.put(
  "/team-games/:resultId",
  playerAuth,
  async (req, res) => {
    try {
      const {
        resultId,
      } = req.params;

      const {
        result,
      } = req.body;

      const isAdmin =
        Boolean(req.isAdmin);

      const teamGameResult =
        await resultService.updateTeamGameResult({
          resultId,
          result,
          isAdmin,
        });

      return res.json({
        success: true,

        message:
          "Team game result updated successfully.",

        result: teamGameResult,
      });

    } catch (error) {

      console.error(
        "[UPDATE TEAM GAME RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code ===
        "TEAM_GAME_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code ===
        "TEAM_RESULT_APPROVED_ADMIN_ONLY"
      ) {
        statusCode = 403;
      }

      if (
        error.code ===
          "INVALID_ID" ||
        error.code ===
          "INVALID_TEAM_RESULT"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,

        message:
          error.message ||
          "Failed to update team game result.",

        code:
          error.code ||
          "TEAM_RESULT_ERROR",
      });
    }
  }
);

// ======================================================
// ADMIN CREATE TEAM GAME RESULT
// ======================================================

router.post(
  "/admin/team-games/:teamGameId",
  adminAuth,
  async (req, res) => {
    try {
      const { teamGameId } = req.params;
      const { result } = req.body;

      const teamGameResult =
        await resultService.createTeamGameResult({
          teamGameId,
          result,
        });

      return res.status(201).json({
        success: true,
        message:
          "Team game result created successfully by administrator.",
        result: teamGameResult,
      });

    } catch (error) {
      console.error(
        "[ADMIN CREATE TEAM GAME RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code === "TEAM_GAME_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code === "TEAM_RESULT_ALREADY_EXISTS"
      ) {
        statusCode = 409;
      }

      if (
        error.code === "INVALID_ID" ||
        error.code === "INVALID_TEAM_RESULT" ||
        error.code === "INVALID_TEAM_GAME"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to create team game result.",
        code:
          error.code ||
          "TEAM_RESULT_ERROR",
      });
    }
  }
);


// ======================================================
// ADMIN UPDATE TEAM GAME RESULT
// ======================================================

router.put(
  "/admin/team-games/:resultId",
  adminAuth,
  async (req, res) => {
    try {
      const { resultId } = req.params;
      const { result } = req.body;

      const teamGameResult =
        await resultService.updateTeamGameResult({
          resultId,
          result,
          isAdmin: true,
        });

      if (
        teamGameResult &&
        teamGameResult.result &&
        Array.isArray(
          teamGameResult.ratingGains
        )
      ) {
        return res.json({
          success: true,
      
          message:
            "Team game result updated successfully by administrator.",
      
          result:
            teamGameResult.result,
      
          ratingGains:
            teamGameResult.ratingGains,
        });
      }
      
      return res.json({
        success: true,
      
        message:
          "Team game result updated successfully by administrator.",
      
        result: teamGameResult,
      });
      
    } catch (error) {
      console.error(
        "[ADMIN UPDATE TEAM GAME RESULT ERROR]",
        error
      );

      let statusCode = 500;

      if (
        error.code === "TEAM_GAME_NOT_FOUND" ||
        error.code === "TEAM_RESULT_NOT_FOUND"
      ) {
        statusCode = 404;
      }

      if (
        error.code === "RESULT_RATING_ALREADY_APPLIED"
      ) {
        statusCode = 409;
      }

      if (
        error.code === "INVALID_ID" ||
        error.code === "INVALID_TEAM_RESULT" ||
        error.code === "INVALID_TEAM_GAME"
      ) {
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message:
          error.message ||
          "Failed to update team game result.",
        code:
          error.code ||
          "TEAM_RESULT_ERROR",
      });
    }
  }
);

router.delete(
  "/admin/delete-all",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await resultService.deleteAllResults();

      return res.json({
        success: true,

        message:
          "All approved results and pairings have been deleted successfully.",

        ...result,
      });

    } catch (error) {
      console.error(
        "[ADMIN DELETE ALL RESULTS ERROR]",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to delete all results and pairings.",

        code:
          error.code ||
          "DELETE_ALL_RESULTS_ERROR",
      });
    }
  }
);

module.exports = router;