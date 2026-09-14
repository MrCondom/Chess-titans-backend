const express = require("express");

const router = express.Router();

const standingsService = require("../services/standingsService");
const { adminAuth } = require("../middleware/adminAuth");


router.post(
  "/tournaments/standings/rebuild-all",
  adminAuth,
  async (req, res) => {
    try {
      const results =
        await standingsService.rebuildAllStandings();

      const successful =
        results.filter(
          (item) => item.success
        ).length;

      const failed =
        results.filter(
          (item) => !item.success
        ).length;

      return res.status(200).json({
        success: true,
        message:
          "All standings rebuilt successfully.",
        total: results.length,
        successful,
        failed,
        results,
      });
    } catch (error) {
      console.error(
        "REBUILD ALL STANDINGS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to rebuild standings.",
      });
    }
  }
);

router.get(
  "/standings/category/:category/:mode",
  async (req, res) => {
    try {
      const standings =
        await standingsService.getCategoryStandings(
          req.params.category,
          req.params.mode
        );

      return res.status(200).json({
        success: true,
        system: "CATEGORY",
        category: req.params.category,
        mode: String(
          req.params.mode
        ).toUpperCase(),
        standings,
      });
    } catch (error) {
      console.error(
        "GET CATEGORY STANDINGS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to get category standings.",
      });
    }
  }
);

router.get(
  "/standings/special/:tournamentId",
  async (req, res) => {
    try {
      const standings =
        await standingsService.getTournamentStandings(
          req.params.tournamentId
        );

      return res.status(200).json({
        success: true,
        system: "SPECIAL",
        tournamentId: Number(
          req.params.tournamentId
        ),
        standings,
      });
    } catch (error) {
      console.error(
        "GET SPECIAL STANDINGS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to get special event standings.",
      });
    }
  }
);


router.get(
  "/standings/team/:mode",
  async (req, res) => {
    try {
      const standings =
        await standingsService.getTeamStandings(
          req.params.mode
        );

      return res.status(200).json({
        success: true,
        system: "TEAM",
        mode: String(
          req.params.mode
        ).toUpperCase(),
        standings,
      });
    } catch (error) {
      console.error(
        "GET TEAM STANDINGS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to get team standings.",
      });
    }
  }
);

module.exports = router;
