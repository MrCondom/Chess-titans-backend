const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const playerAuth = require("../middleware/playerAuth");

const resultService = require("../services/resultService");


router.post("/", async (req, res) => {
  try {
    const {
      pairingId,
      whiteScore,
      blackScore,
    } = req.body;

    const result = await resultService.createResult({
      pairingId,
      whiteScore,
      blackScore,
    });

    res.status(201).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("CREATE RESULT ERROR:", error);

    if (error.code === "PAIRING_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "RESULT_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create result.",
    });
  }
});

router.put("/:resultId", async (req, res) => {
  try {
    const { resultId } = req.params;
    const {
      whiteScore,
      blackScore,
    } = req.body;

    const result = await resultService.updateResult({
      resultId,
      whiteScore,
      blackScore,
    });

    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("UPDATE RESULT ERROR:", error);

    if (error.code === "RESULT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to update result.",
    });
  }
});

router.delete("/all", async (req, res) => {
  try {
    const result = await resultService.deleteAllResults();

    res.status(200).json({
      success: true,
      message: "All results deleted successfully.",
      ...result,
    });
  } catch (error) {
    console.error("DELETE ALL RESULTS ERROR:", error);

    if (error.code === "PAIRINGS_NOT_FINISHED") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete all results.",
    });
  }
});

router.delete("/:resultId", async (req, res) => {
  try {
    const { resultId } = req.params;

    const result = await resultService.deleteResult(
      resultId
    );

    res.status(200).json({
      success: true,
      message: "Result deleted successfully.",
      result,
    });
  } catch (error) {
    console.error("DELETE RESULT ERROR:", error);

    if (error.code === "RESULT_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete result.",
    });
  }
});

module.exports = router;