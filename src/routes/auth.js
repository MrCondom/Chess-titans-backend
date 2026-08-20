
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const prisma = require("../lib/prisma");
const playerAuth = require("../middleware/playerAuth");

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


function cleanString(value) {
  return String(value || "").trim();
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


router.post(
  "/register",
  registrationLimiter,
  async (req, res) => {
    try {
      const {
        username,
        password,
        fullName,
        bio,
        category,
      } = req.body;

      const cleanUsername = normalizeUsername(username);
      const cleanFullName = cleanString(fullName);
      const cleanBio = cleanString(bio);
      const cleanCategory = cleanString(category).toLowerCase();

     
      if (!cleanUsername) {
        return res.status(400).json({
          success: false,
          message: "Username is required.",
        });
      }

      if (!isValidUsername(cleanUsername)) {
        return res.status(400).json({
          success: false,
          message:
            "Username must be 3-30 characters and contain only letters, numbers and underscores.",
        });
      }

      if (!isValidPassword(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be between 8 and 128 characters.",
        });
      }

      if (!cleanFullName) {
        return res.status(400).json({
          success: false,
          message: "Full name is required.",
        });
      }

      if (cleanFullName.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Full name is too long.",
        });
      }

      if (cleanBio.length > 1000) {
        return res.status(400).json({
          success: false,
          message: "Bio is too long.",
        });
      }

      const existingPlayer = await prisma.player.findUnique({
        where: {
          username: cleanUsername,
        },
      });

      if (existingPlayer) {
        return res.status(409).json({
          success: false,
          message: "That username is already registered.",
        });
      }

      const passwordHash = await bcrypt.hash(
        password,
        SALT_ROUNDS
      );

      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.create({
          data: {
            username: cleanUsername,
            fullName: cleanFullName,

            passwordHash,

            status: "INACTIVE",

            category: cleanCategory,
            bio: cleanBio,

            rapidRating: 0,
            blitzRating: 0,
            bulletRating: 0,

            rapidGain: 0,
            blitzGain: 0,
            bulletGain: 0,

            totalPoints: 0,
            totalRounds: 0,
          },
        });

        const approvalRequest =
          await tx.approvalRequest.create({
            data: {
              playerId: player.id,
              type: "REGISTRATION",
              status: "PENDING",

              data: JSON.stringify({
                username: cleanUsername,
                fullName: cleanFullName,
                bio: cleanBio,
                category: cleanCategory,
              }),
            },
          });

        return {
          player,
          approvalRequest,
        };
      });

      return res.status(201).json({
        success: true,

        message:
          "Registration submitted successfully. Your account is under review.",

        player: {
          id: result.player.id,
          username: result.player.username,
          fullName: result.player.fullName,
          status: result.player.status,
        },

        approvalRequest: {
          id: result.approvalRequest.id,
          status: result.approvalRequest.status,
          type: result.approvalRequest.type,
        },
      });
    } catch (error) {
      console.error("POST /auth/register error:", error);

      if (error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "That username is already registered.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Registration failed.",
      });
    }
  }
);


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

      if (player.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message:
            "Your account is still inactive or under review.",
          code: "PLAYER_INACTIVE",
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
          message: "Username is required.",
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
          status: true,
        },
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          message: "Registration not found.",
        });
      }

      const approval =
        await prisma.approvalRequest.findFirst({
          where: {
            playerId: player.id,
            type: "REGISTRATION",
          },

          orderBy: {
            createdAt: "desc",
          },

          select: {
            id: true,
            status: true,
            reason: true,
            reviewedAt: true,
            createdAt: true,
          },
        });

      return res.json({
        success: true,

        registration: {
          username: player.username,
          fullName: player.fullName,
          accountStatus: player.status,

          approval: approval
            ? {
                id: approval.id,
                status: approval.status,
                reason: approval.reason,
                reviewedAt: approval.reviewedAt,
                createdAt: approval.createdAt,
              }
            : null,
        },
      });
    } catch (error) {
      console.error(
        "GET /auth/registration-status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to check registration status.",
      });
    }
  }
);


module.exports = router;
