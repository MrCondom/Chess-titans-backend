const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");

const prisma = require("../lib/prisma");
const playerAuth = require("../middleware/playerAuth");
const approvalService = require("../services/approvalService");


const playerSelect = {
  id: true,
  fullName: true,
  username: true,
  status: true,

  category: true,
  bio: true,

  rapidRating: true,
  blitzRating: true,
  bulletRating: true,

  rapidGain: true,
  blitzGain: true,
  bulletGain: true,

  totalPoints: true,
  totalRounds: true,
  totalWins: true,
  totalDraws: true,
  totalLosses: true,

  tournamentWins: true,

  teamId: true,

  createdAt: true,
  updatedAt: true,
};


function getAuthenticatedPlayerId(req) {
  if (!req.player || req.player.id === undefined || req.player.id === null) {
    return null;
  }

  const playerId = Number(req.player.id);

  if (!Number.isInteger(playerId) || playerId <= 0) {
    return null;
  }

  return playerId;
}


router.get("/me", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },

      select: playerSelect,
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player account not found.",
      });
    }

    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your player account is inactive.",
      });
    }

    return res.status(200).json({
      success: true,
      player,
    });
  } catch (error) {
    console.error("GET CURRENT PLAYER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve player profile.",
    });
  }
});

router.post("/me/bio", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },

      select: {
        id: true,
        status: true,
        bio: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player account not found.",
      });
    }

    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your player account is inactive.",
      });
    }

    const { bio } = req.body;

    if (typeof bio !== "string") {
      return res.status(400).json({
        success: false,
        message: "Bio must be a string.",
      });
    }

    const cleanBio = bio.trim();

    if (cleanBio.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Bio cannot exceed 1000 characters.",
      });
    }

    if (cleanBio === player.bio) {
      return res.status(400).json({
        success: false,
        message: "Your new bio is the same as your current bio.",
      });
    }

    const existingRequest =
      await prisma.approvalRequest.findFirst({
        where: {
          playerId,
          type: "BIO_CHANGE",
          status: "PENDING",
        },
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending bio change request.",
      });
    }

    const result = await approvalService.createApprovalRequest({
      playerId,
      type: "BIO_CHANGE",
      data: {
        bio: cleanBio,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Bio change submitted for administrator approval.",
      approval: result,
    });
  } catch (error) {
    console.error("SUBMIT BIO CHANGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit bio change request.",
    });
  }
});


router.post("/me/username", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },

      select: {
        id: true,
        username: true,
        status: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player account not found.",
      });
    }

    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your player account is inactive.",
      });
    }

    const { username } = req.body;

    if (typeof username !== "string") {
      return res.status(400).json({
        success: false,
        message: "Username must be a string.",
      });
    }

    const cleanUsername = username.trim();

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({
        success: false,
        message: "Username must be between 3 and 30 characters.",
      });
    }

    /*
     * Keep usernames predictable and safe.
     */
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return res.status(400).json({
        success: false,
        message:
          "Username may contain only letters, numbers, and underscores.",
      });
    }

    if (
      cleanUsername.toLowerCase() ===
      player.username.toLowerCase()
    ) {
      return res.status(400).json({
        success: false,
        message: "The new username is the same as your current username.",
      });
    }

    
    const existingPlayer = await prisma.player.findUnique({
      where: {
        username: cleanUsername,
      },

      select: {
        id: true,
      },
    });

    if (existingPlayer && existingPlayer.id !== playerId) {
      return res.status(409).json({
        success: false,
        message: "That username is already in use.",
      });
    }

    const existingRequest =
      await prisma.approvalRequest.findFirst({
        where: {
          playerId,
          type: "USERNAME_CHANGE",
          status: "PENDING",
        },
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending username change request.",
      });
    }

    const result = await approvalService.createApprovalRequest({
      playerId,
      type: "USERNAME_CHANGE",
      data: {
        username: cleanUsername,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Username change submitted for administrator approval.",
      approval: result,
    });
  } catch (error) {
    console.error("SUBMIT USERNAME CHANGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit username change request.",
    });
  }
});


router.post("/me/profile", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },

      select: {
        id: true,
        fullName: true,
        category: true,
        status: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player account not found.",
      });
    }

    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your player account is inactive.",
      });
    }

    const { fullName, category } = req.body;

    const data = {};

    if (fullName !== undefined) {
      if (typeof fullName !== "string") {
        return res.status(400).json({
          success: false,
          message: "Full name must be a string.",
        });
      }

      const cleanFullName = fullName.trim();

      if (
        cleanFullName.length < 2 ||
        cleanFullName.length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Full name must be between 2 and 100 characters.",
        });
      }

      data.fullName = cleanFullName;
    }

    if (category !== undefined) {
      if (typeof category !== "string") {
        return res.status(400).json({
          success: false,
          message: "Category must be a string.",
        });
      }

      const cleanCategory = category.trim();

      if (cleanCategory.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Category cannot exceed 100 characters.",
        });
      }

      data.category = cleanCategory;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No profile changes were submitted.",
      });
    }

    if (
      data.fullName !== undefined &&
      data.fullName === player.fullName &&
      data.category !== undefined &&
      data.category === player.category
    ) {
      return res.status(400).json({
        success: false,
        message: "No changes were detected.",
      });
    }

    const existingRequest =
      await prisma.approvalRequest.findFirst({
        where: {
          playerId,
          type: "PROFILE_CHANGE",
          status: "PENDING",
        },
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message: "You already have a pending profile change request.",
      });
    }

    const result = await approvalService.createApprovalRequest({
      playerId,
      type: "PROFILE_CHANGE",
      data,
    });

    return res.status(201).json({
      success: true,
      message:
        "Profile change submitted for administrator approval.",
      approval: result,
    });
  } catch (error) {
    console.error("SUBMIT PROFILE CHANGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit profile change request.",
    });
  }
});



router.post("/me/password", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const player = await prisma.player.findUnique({
      where: {
        id: playerId,
      },

      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player account not found.",
      });
    }

    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Your player account is inactive.",
      });
    }

    const {
      currentPassword,
      newPassword,
    } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required.",
      });
    }

    if (!player.passwordHash) {
      return res.status(400).json({
        success: false,
        message:
          "Password authentication is not available for this account.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      player.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        message: "New password is too long.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be different from the current password.",
      });
    }

    const existingRequest =
      await prisma.approvalRequest.findFirst({
        where: {
          playerId,
          type: "PASSWORD_CHANGE",
          status: "PENDING",
        },
      });

    if (existingRequest) {
      return res.status(409).json({
        success: false,
        message:
          "You already have a pending password change request.",
      });
    }

   
    const newPasswordHash = await bcrypt.hash(
      newPassword,
      12
    );

    const result = await approvalService.createApprovalRequest({
      playerId,
      type: "PASSWORD_CHANGE",
      data: {
        passwordHash: newPasswordHash,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "Password change submitted for administrator approval.",
      approval: result,
    });
  } catch (error) {
    console.error("SUBMIT PASSWORD CHANGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to submit password change request.",
    });
  }
});


router.get("/me/approvals", playerAuth, async (req, res) => {
  try {
    const playerId = getAuthenticatedPlayerId(req);

    if (!playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication.",
      });
    }

    const approvals = await prisma.approvalRequest.findMany({
      where: {
        playerId,
      },

      select: {
        id: true,
        type: true,
        status: true,
        reason: true,
        reviewedAt: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: approvals.length,
      approvals,
    });
  } catch (error) {
    console.error("GET PLAYER APPROVALS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approval requests.",
    });
  }
});


router.get(
  "/me/approvals/:id",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = getAuthenticatedPlayerId(req);

      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: "Invalid player authentication.",
        });
      }

      const approvalId = Number(req.params.id);

      if (!Number.isInteger(approvalId) || approvalId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid approval request ID.",
        });
      }

      const approval =
        await prisma.approvalRequest.findFirst({
          where: {
            id: approvalId,
            playerId,
          },

          select: {
            id: true,
            type: true,
            status: true,
            reason: true,
            reviewedAt: true,
            createdAt: true,
          },
        });

    if (!approval) {
        return res.status(404).json({
          success: false,
          message: "Approval request not found.",
        });
      }

      return res.status(200).json({
        success: true,
        approval,
      });
    } catch (error) {
      console.error(
        "GET PLAYER APPROVAL ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve approval request.",
      });
    }
  }
);


router.get("/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid player ID.",
      });
    }

    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        status: "ACTIVE",
      },

      select: {
        id: true,
        fullName: true,
        username: true,

        category: true,
        bio: true,

        rapidRating: true,
        blitzRating: true,
        bulletRating: true,

        rapidGain: true,
        blitzGain: true,
        bulletGain: true,

        totalPoints: true,
        totalRounds: true,
        totalWins: true,
        totalLosses: true,
        totalDraws: true,

        tournamentWins: true,

        teamId: true,

        createdAt: true,
      },
    });

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found.",
      });
    }

    return res.status(200).json({
      success: true,
      player,
    });
  } catch (error) {
    console.error("GET PUBLIC PLAYER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve player.",
    });
  }
});


module.exports = router;