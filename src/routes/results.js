const express = require("express");
const router = express.Router();

const ratingService = require("../services/ratingService");

router.patch(
  "/results/:resultId/recalculate-gain",
  async (req, res) => {
    try {
      const result =
        await ratingService.recalculateEditedResultGains(
          req.params.resultId
        );

      return res.status(200).json({
        success: true,
        message: "Rating gains recalculated successfully.",
        data: result,
      });

    } catch (error) {
      console.error(
        "RECALCULATE RESULT GAIN ERROR:",
        error
      );

      if (error.code === "RESULT_NOT_FOUND") {
        return res.status(404).json({
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
        message: "Failed to recalculate rating gain.",
      });
    }
  }
);


router.post(
  "/results/:resultId/approve",
  async (req, res) => {
    try {
      const result =
        await ratingService.approveResult(
          req.params.resultId
        );

      return res.status(200).json({
        success: true,
        message: "Result approved successfully.",
        data: result,
      });

    } catch (error) {
      console.error(
        "APPROVE RESULT ERROR:",
        error
      );

      if (error.code === "RESULT_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (
        error.code === "RESULT_ALREADY_REVIEWED"
      ) {
        return res.status(409).json({
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
        message: "Failed to approve result.",
      });
    }
  }
);


router.post(
  "/rating-gains/:ratingGainId/apply",
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