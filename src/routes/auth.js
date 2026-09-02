
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const prisma = require("../lib/prisma");
const playerAuth = require("../middleware/playerAuth");
const approvalService = require("../services/approvalService");

const router = express.Router();



const SALT_ROUNDS = 12;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many registration attempts. Please try again later.",
  },
});


function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}


function isValidUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}


function isValidPassword(password) {
  if (typeof password !== "string") {
    return false;
  }

  if (password.length < 8) {
    return false;
  }

  if (password.length > 128) {
    return false;
  }

  return true;
}


function createPlayerToken(player) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      playerId: player.id,
      username: player.username,
      type: "player",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
}


function publicPlayer(player) {
  return {
    id: player.id,
    username: player.username,
    fullName: player.fullName,
    status: player.status,
    category: player.category,
    bio: player.bio,

    rapidRating: player.rapidRating,
    blitzRating: player.blitzRating,
    bulletRating: player.bulletRating,

    rapidGain: player.rapidGain,
    blitzGain: player.blitzGain,
    bulletGain: player.bulletGain,

    totalPoints: player.totalPoints,
    totalRounds: player.totalRounds,

    tournamentWins: player.tournamentWins,

    teamId: player.teamId,

    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };
}


router.post("/register", registrationLimiter, async (req, res) =>  {
  try {
    const {
      username,
      password,
      bio = "",
      rapidRating = 0,
      blitzRating = 0,
      bulletRating = 0,
    } = req.body;

    // ------------------------------------------
    // BASIC VALIDATION
    // ------------------------------------------

    if (
      typeof username !== "string" ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    if (
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Password is required.",
      });
    }

    const cleanUsername =
      username.trim().toLowerCase();

    if (
      !/^[a-z0-9_]{3,30}$/.test(cleanUsername)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3-30 characters and contain only letters, numbers and underscores.",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    if (
      typeof bio !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Bio must be a string.",
      });
    }

    // ------------------------------------------
    // VALIDATE RATINGS
    // ------------------------------------------

    const ratings = {
      rapidRating,
      blitzRating,
      bulletRating,
    };

    for (const [field, value] of Object.entries(ratings)) {
      if (
        !Number.isInteger(value) ||
        value < 0
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a valid non-negative integer.`,
        });
      }
    }

    // ------------------------------------------
    // FIND THE PLAYER CREATED BY ADMIN
    // ------------------------------------------

    const player =
      await prisma.player.findUnique({
        where: {
          username: cleanUsername,
        },
      });

    if (!player) {
      return res.status(404).json({
        success: false,
        message:
          "No player account was found for this username. Please contact the administrator.",
      });
    }

    // ------------------------------------------
    // ONLY UNREGISTERED PLAYERS CAN REGISTER
    // ------------------------------------------

    if (player.status !== "UNREGISTERED") {
      if (player.status === "ACTIVE") {
        return res.status(409).json({
          success: false,
          message:
            "This player account is already registered.",
          code: "ALREADY_REGISTERED",
        });
      }

      return res.status(409).json({
        success: false,
        message:
          "This player account is not currently available for registration.",
        code: "REGISTRATION_NOT_AVAILABLE",
      });
    }

   

    const passwordHash =
      await bcrypt.hash(password, SALT_ROUNDS);

    
    const approval =
      await approvalService.createApprovalRequest({
        playerId: player.id,

        type: "REGISTRATION",

        data: {
          // Existing administrator-created data
          fullName: player.fullName,
          username: player.username,
          category: player.category,

          // User-provided registration data
          bio: bio.trim(),

          rapidRating,
          blitzRating,
          bulletRating,

          // IMPORTANT:
          // Password is stored as a hash, never plain text.
          passwordHash,
        },
      });

    return res.status(201).json({
      success: true,
      message:
        "Registration submitted successfully. Your account is awaiting administrator approval.",

      approval: {
        id: approval.id,
        type: approval.type,
        status: approval.status,
        createdAt: approval.createdAt,
      },
    });

  } catch (error) {
    console.error(
      "PLAYER REGISTRATION ERROR:",
      error
    );

    if (
      error.code ===
      "PENDING_APPROVAL_EXISTS"
    ) {
      return res.status(409).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to submit registration.",
    });
  }
});

router.post(
  "/login",
  loginLimiter,
  async (req, res) => {
    try {
      const username = normalizeUsername(
        req.body.username
      );

      const password = req.body.password;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required.",
        });
      }

      const player = await prisma.player.findUnique({
        where: {
          username,
        },
      });

      // Don't reveal whether the username exists.
      if (!player || !player.passwordHash) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password.",
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          player.passwordHash
        );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password.",
        });
      }

      if (player.status === "UNREGISTERED") {
        return res.status(403).json({
          success: false,
          message:
            "This player account has not been registered yet.",
          code: "PLAYER_UNREGISTERED",
        });
      }
      
      const token = createPlayerToken(player);

      return res.json({
        success: true,
        message: "Login successful.",

        token,

        player: publicPlayer(player),
      });
    } catch (error) {
      console.error("POST /auth/login error:", error);

      return res.status(500).json({
        success: false,
        message: "Login failed.",
      });
    }
  }
);

// ======================================================
// PLAYER APPROVAL STATUS
// ======================================================

router.get(
  "/approval-status",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = req.playerId;

      if (!playerId) {
        return res.status(401).json({
          success: false,
          message: "Player authentication is invalid.",
        });
      }

      const result =
        await approvalService.getPlayerApprovalRequests(
          playerId
        );

      return res.status(200).json({
        success: true,
        ...result,
      });

    } catch (error) {
      console.error(
        "GET /auth/approval-status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "An error occurred while retrieving approval status.",
      });
    }
  }
);

router.get(
  "/me",
  playerAuth,
  async (req, res) => {
    try {
      const player = await prisma.player.findUnique({
        where: {
          id: req.player.id,
        },

        include: {
          team: {
            include: {
              captain: {
                select: {
                  id: true,
                  username: true,
                  fullName: true,
                },
              },
            },
          },

          captainOfTeam: true,

          rankings: {
            orderBy: {
              createdAt: "desc",
            },

            take: 20,
          },

          ratingGains: {
            orderBy: {
              createdAt: "desc",
            },

            take: 20,
          },

          teamMemberships: {
            include: {
              team: true,
            },
          },

          notifications: {
            where: {
              isRead: false,
            },

            orderBy: {
              createdAt: "desc",
            },

            take: 50,
          },
        },
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          message: "Player not found.",
        });
      }

      return res.json({
        success: true,
        player: publicPlayer(player),

        team: player.team,

        captainOfTeam: player.captainOfTeam,

        rankings: player.rankings,

        ratingGains: player.ratingGains,

        teamMemberships: player.teamMemberships,

        unreadNotifications: player.notifications,
      });
    } catch (error) {
      console.error("GET /auth/me error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load player profile.",
      });
    }
  }
);

router.get(
  "/registration-status/:username",
  async (req, res) => {
    try {
      const username = normalizeUsername(
        req.params.username
      );

      if (!username) {
        return res.status(400).json({
          success: false,
          eligible: false,
          code: "USERNAME_REQUIRED",
          message: "Username is required.",
        });
      }

      if (!isValidUsername(username)) {
        return res.status(400).json({
          success: false,
          eligible: false,
          code: "INVALID_USERNAME",
          message:
            "Username must be 3-30 characters and contain only letters, numbers and underscores.",
        });
      }

      const player = await prisma.player.findUnique({
        where: {
          username,
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          category: true,
          status: true,
          passwordHash: true,
        },
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          eligible: false,
          code: "PLAYER_NOT_FOUND",
          message:
            "This username has not been added by an administrator.",
        });
      }

      const pendingApproval =
        await prisma.approvalRequest.findFirst({
          where: {
            playerId: player.id,
            type: "REGISTRATION",
            status: "PENDING",
          },
        });
      
      if (pendingApproval) {
        return res.status(409).json({
          success: false,
          eligible: false,
          code: "PENDING_APPROVAL_EXISTS",
          message:
            "Your registration is already awaiting administrator approval.",
        });
      }

      // If password already exists, registration has already started/completed.
      if (player.passwordHash) {
        return res.status(409).json({
          success: false,
          eligible: false,
          code: "ALREADY_REGISTERED",
          message:
            "This player has already registered.",
        });
      }

      if (player.status !== "UNREGISTERED") {
        return res.status(409).json({
          success: false,
          eligible: false,
          code: "REGISTRATION_NOT_AVAILABLE",
          message:
            `This player is not currently eligible for registration. Current status: ${player.status}`,
        });
      }

      return res.status(200).json({
        success: true,
        eligible: true,
        code: "REGISTRATION_AVAILABLE",

        player: {
          username: player.username,
          fullName: player.fullName,
          category: player.category,
        },

        message:
          "Username verified. You may continue with registration.",
      });

    } catch (error) {
      console.error(
        "GET /auth/registration-status error:",
        error
      );

      return res.status(500).json({
        success: false,
        eligible: false,
        message:
          "Failed to check registration eligibility.",
      });
    }
  }
);

module.exports = router;
