const express = require("express");
const router = express.Router();

const ratingService = require("../services/ratingService");

const { adminAuth } = require("../middleware/adminAuth");

router.patch(
  "/results/:resultId/recalculate-gain",
  adminAuth,
  async (req, res) => {
    try {
      const resultType = String(
        req.body?.resultType || "GAME"
      )
        .trim()
        .toUpperCase();

      if (
        resultType !== "GAME" &&
        resultType !== "TEAM"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid result type. Use GAME or TEAM.",
          code: "INVALID_RESULT_TYPE",
        });
      }

      const result =
        await ratingService.recalculateEditedResultGains(
          req.params.resultId,
          resultType
        );

      return res.status(200).json({
        success: true,
        message:
          "Rating gains recalculated successfully.",
        data: result,
      });
    } catch (error) {
      console.error(
        "RECALCULATE RESULT GAIN ERROR:",
        error
      );

      return res.status(
        error.code === "RESULT_NOT_FOUND"
          ? 404
          : error.code === "INVALID_ID" ||
            error.code === "INVALID_RESULT_TYPE"
          ? 400
          : 500
      ).json({
        success: false,
        message:
          error.message ||
          "Failed to recalculate rating gains.",
        code:
          error.code ||
          "RECALCULATE_RESULT_GAIN_ERROR",
      });
    }
  }
);


router.get(
  "/rating-gains/pending",
  adminAuth,
  async (req, res) => {
    try {
      const ratingGains =
        await ratingService.getPendingRatingGains();

      return res.status(200).json({
        success: true,
        ratingGains,
        count: ratingGains.length,
      });

    } catch (error) {
      console.error(
        "GET PENDING RATING GAINS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to load pending rating gains.",
        code:
          error.code ||
          "PENDING_RATING_GAINS_ERROR",
      });
    }
  }
);

router.post(
  "/rating-gains/:ratingGainId/apply",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await ratingService.applyRatingGain(
          req.params.ratingGainId
        );

      return res.status(200).json({
        success: true,
        message: "Rating gain applied successfully.",
        data: result,
      });

    } catch (error) {
      console.error(
        "APPLY RATING GAIN ERROR:",
        error
      );

      if (
        error.code === "RATING_GAIN_NOT_FOUND"
      ) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.code === "RATING_GAIN_NOT_APPROVED"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error.code === "INVALID_ID") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to apply rating gain.",
      });
    }
  }
);


module.exports = router;
