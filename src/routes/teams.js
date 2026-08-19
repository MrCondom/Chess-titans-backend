const express = require("express");

const teamService = require("../services/teamService");

const playerAuth = require("../middleware/playerAuth");
const adminAuth = require("../middleware/adminAuth");


const router = express.Router();



router.get("/", async (req, res) => {
  try {
    const result = await teamService.getAllTeams({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("GET TEAMS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
      code: error.code || "GET_TEAMS_FAILED",
    });
  }
});


router.get("/:teamId", async (req, res) => {
  try {
    const team = await teamService.getTeamById(
      req.params.teamId
    );

    return res.json({
      success: true,
      team,
    });
  } catch (error) {
    console.error("GET TEAM ERROR:", error);

    const status =
      error.code === "TEAM_NOT_FOUND"
        ? 404
        : 400;

    return res.status(status).json({
      success: false,
      message: error.message,
      code: error.code || "GET_TEAM_FAILED",
    });
  }
});


router.post(
  "/",
  adminAuth,
  async (req, res) => {
    try {
      const {
        name,
        description,
        captainId,
      } = req.body;

      const team =
        await teamService.createTeam({
          name,
          description,
          captainId,
        });

      return res.status(201).json({
        success: true,
        message: "Team created successfully.",
        team,
      });
    } catch (error) {
      console.error("CREATE TEAM ERROR:", error);

      const status =
        error.code === "TEAM_NAME_EXISTS"
          ? 409
          : error.code === "PLAYER_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "CREATE_TEAM_FAILED",
      });
    }
  }
);


router.patch(
  "/:teamId",
  adminAuth,
  async (req, res) => {
    try {
      const team =
        await teamService.updateTeam(
          req.params.teamId,
          {
            name: req.body.name,
            description: req.body.description,
          }
        );

      return res.json({
        success: true,
        message: "Team updated successfully.",
        team,
      });
    } catch (error) {
      console.error("UPDATE TEAM ERROR:", error);

      const status =
        error.code === "TEAM_NOT_FOUND"
          ? 404
          : error.code === "TEAM_NAME_EXISTS"
          ? 409
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "UPDATE_TEAM_FAILED",
      });
    }
  }
);


router.delete(
  "/:teamId",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await teamService.deleteTeam(
          req.params.teamId
        );

      return res.json(result);
    } catch (error) {
      console.error("DELETE TEAM ERROR:", error);

      const status =
        error.code === "TEAM_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "DELETE_TEAM_FAILED",
      });
    }
  }
);



router.post(
  "/:teamId/members",
  adminAuth,
  async (req, res) => {
    try {
      const team =
        await teamService.addPlayerToTeam(
          req.params.teamId,
          req.body.playerId
        );

      return res.status(201).json({
        success: true,
        message: "Player added to team successfully.",
        team,
      });
    } catch (error) {
      console.error(
        "ADD TEAM MEMBER ERROR:",
        error
      );

      let status = 400;

      if (
        error.code === "TEAM_NOT_FOUND" ||
        error.code === "PLAYER_NOT_FOUND"
      ) {
        status = 404;
      }

      if (
        error.code === "PLAYER_ALREADY_IN_TEAM" ||
        error.code === "ALREADY_TEAM_MEMBER"
      ) {
        status = 409;
      }

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "ADD_TEAM_MEMBER_FAILED",
      });
    }
  }
);


router.delete(
  "/:teamId/members/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const team =
        await teamService.removePlayerFromTeam(
          req.params.teamId,
          req.params.playerId
        );

      return res.json({
        success: true,
        message: "Player removed from team successfully.",
        team,
      });
    } catch (error) {
      console.error(
        "REMOVE TEAM MEMBER ERROR:",
        error
      );

      const status =
        error.code === "TEAM_NOT_FOUND" ||
        error.code === "PLAYER_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "REMOVE_TEAM_MEMBER_FAILED",
      });
    }
  }
);


/*
 * GET /teams/:teamId/memberships
 *
 * Membership history.
 */
router.get(
  "/:teamId/memberships",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await teamService.getTeamMemberships(
          req.params.teamId,
          {
            status: req.query.status,
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
        "GET TEAM MEMBERSHIPS ERROR:",
        error
      );

      const status =
        error.code === "TEAM_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "GET_TEAM_MEMBERSHIPS_FAILED",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| Captain Management
|--------------------------------------------------------------------------
*/


/*
 * PATCH /teams/:teamId/captain
 */
router.patch(
  "/:teamId/captain",
  adminAuth,
  async (req, res) => {
    try {
      const team =
        await teamService.appointCaptain(
          req.params.teamId,
          req.body.playerId
        );

      return res.json({
        success: true,
        message: "Team captain updated successfully.",
        team,
      });
    } catch (error) {
      console.error(
        "APPOINT CAPTAIN ERROR:",
        error
      );

      const status =
        error.code === "TEAM_NOT_FOUND" ||
        error.code === "PLAYER_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "APPOINT_CAPTAIN_FAILED",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| Player's Own Team
|--------------------------------------------------------------------------
*/


/*
 * GET /teams/player/me
 *
 * IMPORTANT:
 * This route must appear before /:teamId.
 */
router.get(
  "/player/me",
  playerAuth,
  async (req, res) => {
    try {
      const team =
        await teamService.getPlayerTeam(
          req.user.id
        );

      return res.json({
        success: true,
        team,
      });
    } catch (error) {
      console.error(
        "GET PLAYER TEAM ERROR:",
        error
      );

      const status =
        error.code === "PLAYER_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "GET_PLAYER_TEAM_FAILED",
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| Team Pairings
|--------------------------------------------------------------------------
*/


/*
 * POST /teams/pairings
 */
router.post(
  "/pairings",
  adminAuth,
  async (req, res) => {
    try {
      const pairing =
        await teamService.createTeamPairing({
          round: req.body.round,
          teamAId: req.body.teamAId,
          teamBId: req.body.teamBId,
          availableAt: req.body.availableAt,
        });

      return res.status(201).json({
        success: true,
        message: "Team pairing created successfully.",
        pairing,
      });
    } catch (error) {
      console.error(
        "CREATE TEAM PAIRING ERROR:",
        error
      );

      const status =
        error.code === "TEAM_NOT_FOUND"
          ? 404
          : error.code === "TEAM_PAIRING_EXISTS"
          ? 409
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "CREATE_TEAM_PAIRING_FAILED",
      });
    }
  }
);


/*
 * GET /teams/pairings
 */
router.get(
  "/pairings",
  playerAuth,
  async (req, res) => {
    try {
      const result =
        await teamService.getTeamPairings({
          teamId: req.query.teamId,
          round: req.query.round,
          page: req.query.page,
          limit: req.query.limit,
        });

      return res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      console.error(
        "GET TEAM PAIRINGS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "GET_TEAM_PAIRINGS_FAILED",
      });
    }
  }
);


/*
 * GET /teams/pairings/:pairingId
 */
router.get(
  "/pairings/:pairingId",
  playerAuth,
  async (req, res) => {
    try {
      const pairing =
        await teamService.getTeamPairingById(
          req.params.pairingId
        );

      return res.json({
        success: true,
        pairing,
      });
    } catch (error) {
      console.error(
        "GET TEAM PAIRING ERROR:",
        error
      );

      const status =
        error.code ===
        "TEAM_PAIRING_NOT_FOUND"
          ? 404
          : 400;

      return res.status(status).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "GET_TEAM_PAIRING_FAILED",
      });
    }
  }
);


module.exports = router;
