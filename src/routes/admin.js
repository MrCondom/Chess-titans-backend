const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");
const { adminAuth } = require("../middleware/adminAuth");
const approvalService = require("../services/approvalService");
const ratingService = require("../services/ratingService");

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");


const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many login attempts. Please try again later.",
  },
});


router.post(
  "/login",
  adminLoginLimiter,
  async (req, res) => {
    try {
      const { username, password } = req.body;

      if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required.",
        });
      }

      const cleanUsername = username.trim().toLowerCase();

      const admin = await prisma.admin.findUnique({
        where: {
          username: cleanUsername,
        },
      });

      // Do not reveal whether the username exists.
      if (!admin || !admin.passwordHash) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password.",
        });
      }

      const passwordMatches = await bcrypt.compare(
        password,
        admin.passwordHash
      );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password.",
        });
      }

      if (admin.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message: "Admin account is inactive.",
        });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured.");
      }

      const token = jwt.sign(
        {
          adminId: admin.id,
          username: admin.username,
          type: "admin",
        },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRES_IN || "7d",
        }
      );

      return res.status(200).json({
        success: true,
        message: "Admin login successful.",
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          status: admin.status,
        },
      });

    } catch (error) {
      console.error("ADMIN LOGIN ERROR:", error);

      return res.status(500).json({
        success: false,
        message: "Admin login failed.",
      });
    }
  }
);

router.post("/players", adminAuth, async (req, res) => {
  try {
    const {
      username,
      fullName,
      category,
    } = req.body;

    if (
      typeof username !== "string" ||
      !username.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Username is required.",
      });
    }

    const cleanUsername =
      username.trim().toLowerCase();

    if (
      !/^[a-z0-9_]{3,30}$/.test(
        cleanUsername
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Username must be 3-30 characters and contain only letters, numbers and underscores.",
      });
    }


    if (
      typeof fullName !== "string" ||
      !fullName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Full name is required.",
      });
    }

    const cleanFullName =
      fullName.trim();

    if (cleanFullName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Full name is too long.",
      });
    }

    if (
      typeof category !== "string" ||
      !category.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    const cleanCategory =
      category.trim().toLowerCase();


    const existingPlayer =
      await prisma.player.findUnique({
        where: {
          username: cleanUsername,
        },
      });

    if (existingPlayer) {
      return res.status(409).json({
        success: false,
        message:
          "A player with this username already exists.",
      });
    }
    const player = await prisma.player.create({
      data: {
        username: cleanUsername,
        fullName: cleanFullName,
    
        passwordHash: null,
    
        status: "UNREGISTERED",
    
        category: cleanCategory,
        bio: "",
    
        rapidRating: 0,
        blitzRating: 0,
        bulletRating: 0,
    
        rapidGain: 0,
        blitzGain: 0,
        bulletGain: 0,
    
        totalPoints: 0,
        totalRounds: 0,
    
        totalWins: 0,
        totalLosses: 0,
        totalDraws: 0,
    
        tournamentWins: 0,
      },
    });
    
    return res.status(201).json({
      success: true,
      message:
        "Player created successfully.",
      player: {
        id: player.id,
        username: player.username,
        fullName: player.fullName,
        status: player.status,
        category: player.category,
        bio: player.bio,
        createdAt: player.createdAt,
      },
    });

  } catch (error) {
    console.error(
      "ADMIN CREATE PLAYER ERROR:",
      error
    );

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message:
          "A player with this username already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create player.",
    });
  }
});

router.get("/players/unregistered", adminAuth, async (req, res) => {
  try {
    const players = await prisma.player.findMany({
      where: {
        status: "UNREGISTERED",
      },

      select: {
        id: true,
        username: true,
        fullName: true,
        category: true,
        status: true,
        createdAt: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: players.length,
      players,
    });
  } catch (error) {
    console.error("GET UNREGISTERED PLAYERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve unregistered players.",
    });
  }
});


router.delete(
  "/players/:username",
  adminAuth,
  async (req, res) => {
    try {
      const username = req.params.username
        .trim()
        .toLowerCase();

      if (!username) {
        return res.status(400).json({
          success: false,
          message: "Player username is required.",
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
          message: "Player not found.",
        });
      }

      await prisma.player.delete({
        where: {
          id: player.id,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Player deleted permanently.",
        player: {
          id: player.id,
          username: player.username,
          fullName: player.fullName,
          status: player.status,
        },
      });

    } catch (error) {
      console.error(
        "DELETE PLAYER ERROR:",
        error
      );

      if (error.code === "P2003") {
        return res.status(409).json({
          success: false,
          message:
            "This player cannot be deleted because other records depend on this player.",
          code: "PLAYER_HAS_DEPENDENCIES",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to delete player.",
      });
    }
  }
);

router.patch(
  "/players/:username/status",
  adminAuth,
  async (req, res) => {
    try {
      const username = req.params.username
        .trim()
        .toLowerCase();

      if (!username) {
        return res.status(400).json({
          success: false,
          message: "Player username is required.",
        });
      }

      const { status } = req.body;

      if (typeof status !== "string") {
        return res.status(400).json({
          success: false,
          message: "Player status is required.",
        });
      }

      const cleanStatus =
        status.trim().toUpperCase();

      const allowedStatuses = [
        "ACTIVE",
        "INACTIVE",
        "SUSPENDED",
        "UNREGISTERED",
      ];

      if (!allowedStatuses.includes(cleanStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid player status. Allowed statuses: ACTIVE, INACTIVE, SUSPENDED, UNREGISTERED.",
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
          message: "Player not found.",
        });
      }

      if (player.status === cleanStatus) {
        return res.status(409).json({
          success: false,
          message:
            `Player is already ${cleanStatus.toLowerCase()}.`,
        });
      }

      const updatedPlayer =
        await prisma.player.update({
          where: {
            id: player.id,
          },

          data: {
            status: cleanStatus,
          },

          select: {
            id: true,
            username: true,
            fullName: true,
            status: true,
            updatedAt: true,
          },
        });

      return res.status(200).json({
        success: true,
        message:
          `Player status changed to ${cleanStatus.toLowerCase()} successfully.`,
        player: updatedPlayer,
      });

    } catch (error) {
      console.error(
        "CHANGE PLAYER STATUS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to change player status.",
      });
    }
  }
);

router.get("/approvals", adminAuth, async (req, res) => {
  try {
    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const type = req.query.type || null;

    const result = await approvalService.getPendingApprovals({
      page,
      limit,
      type,
    });
    
    return res.status(200).json({
      success: true,
      approvals: result.requests,
      pagination: result.pagination,
    });

  } catch (error) {
    console.error("GET PENDING APPROVALS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approval requests.",
    });
  }
});


router.get("/approvals/:id", adminAuth, async (req, res) => {
  try {
    const approvalId = Number(req.params.id);

    if (!Number.isInteger(approvalId) || approvalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval request ID.",
      });
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: {
        id: approvalId,
      },

      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
            bio: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        admin: {
          select: {
            id: true,
            username: true,
          },
        },
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
    console.error("GET APPROVAL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approval request.",
    });
  }
});


router.post("/approvals/:id/approve", adminAuth, async (req, res) => {
  try {
    const approvalId = Number(req.params.id);

    if (!Number.isInteger(approvalId) || approvalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval request ID.",
      });
    }

    if (!req.admin || !req.admin.id) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    const adminId = Number(req.admin.id);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator session.",
      });
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: {
        id: approvalId,
      },
    });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval request not found.",
      });
    }

    if (approval.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `This approval request has already been ${approval.status.toLowerCase()}.`,
      });
    }

    const result = await approvalService.approveRequest(
      approvalId,
      adminId
    );

    return res.status(200).json({
      success: true,
      message: "Approval request approved successfully.",
      approval: result,
    });
  } catch (error) {
    console.error("APPROVE REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to approve request.",
    });
  }
});


router.post("/approvals/:id/reject", adminAuth, async (req, res) => {
  try {
    const approvalId = Number(req.params.id);

    if (!Number.isInteger(approvalId) || approvalId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval request ID.",
      });
    }

    if (!req.admin || !req.admin.id) {
      return res.status(401).json({
        success: false,
        message: "Administrator authentication required.",
      });
    }

    const adminId = Number(req.admin.id);

    if (!Number.isInteger(adminId) || adminId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid administrator session.",
      });
    }

    const { reason } = req.body;

    if (
      reason !== undefined &&
      reason !== null &&
      typeof reason !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason must be a string.",
      });
    }

    const cleanReason = reason
      ? reason.trim()
      : null;

    if (cleanReason && cleanReason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is too long.",
      });
    }

    const approval = await prisma.approvalRequest.findUnique({
      where: {
        id: approvalId,
      },
    });

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: "Approval request not found.",
      });
    }

    if (approval.status !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: `This approval request has already been ${approval.status.toLowerCase()}.`,
      });
    }

    const result = await approvalService.rejectRequest(
      approvalId,
      adminId,
      cleanReason
    );

    return res.status(200).json({
      success: true,
      message: "Approval request rejected successfully.",
      approval: result,
    });
  } catch (error) {
    console.error("REJECT REQUEST ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to reject request.",
    });
  }
});


router.get("/approvals/history", adminAuth, async (req, res) => {
  try {
    const approvals = await prisma.approvalRequest.findMany({
      where: {
        status: {
          in: ["APPROVED", "REJECTED"],
        },
      },

      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
          },
        },

        admin: {
          select: {
            id: true,
            username: true,
          },
        },
      },

      orderBy: {
        reviewedAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: approvals.length,
      approvals,
    });
  } catch (error) {
    console.error("GET APPROVAL HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approval history.",
    });
  }
});

router.patch(
  "/approvals/:id",
  adminAuth,
  async (req, res) => {
    try {
      const approvalId = Number(req.params.id);

      if (
        !Number.isInteger(approvalId) ||
        approvalId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid approval request ID.",
        });
      }

      if (!req.admin || !req.admin.id) {
        return res.status(401).json({
          success: false,
          message: "Administrator authentication required.",
        });
      }

      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        return res.status(400).json({
          success: false,
          message: "Approval data must be an object.",
        });
      }

      const approval =
        await approvalService.editApprovalRequest(
          approvalId,
          req.body
        );

      return res.status(200).json({
        success: true,
        message:
          "Approval request updated successfully.",
        approval,
      });

    } catch (error) {
      console.error(
        "EDIT APPROVAL REQUEST ERROR:",
        error
      );

      if (error.code === "APPROVAL_NOT_FOUND") {
        return res.status(404).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      if (
        error.code === "APPROVAL_NOT_PENDING"
      ) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      if (
        error.code === "UNSUPPORTED_APPROVAL_EDIT"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      if (
        error.code === "INVALID_APPROVAL_DATA"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Failed to update approval request.",
      });
    }
  }
);

router.get(
  "/results/pending",
  adminAuth,
  async (req, res) => {
    try {
      const results =
        await ratingService.getAllResults({
          approvalStatus: "PENDING",
          category:
            req.query.category,
          mode:
            req.query.mode,
          round:
            req.query.round,
        });

      return res.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error(
        "GET PENDING RESULTS ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

router.post(
  "/results/:id/approve",
  adminAuth,
  async (req, res) => {
    try {
      const result =
        await ratingService.approveResult(
          req.params.id
        );

      return res.json({
        success: true,
        message:
          "Result approved and ratings updated successfully.",
        result,
      });
    } catch (error) {
      console.error(
        "APPROVE RESULT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "RESULT_APPROVAL_ERROR",
      });
    }
  }
);


router.post(
  "/results/:id/reject",
  adminAuth,
  async (req, res) => {
    try {
      const {
        reason,
      } = req.body;

      const result =
        await ratingService.rejectResult(
          req.params.id,
          reason
        );

      return res.json({
        success: true,
        message:
          "Result rejected successfully.",
        result,
      });
    } catch (error) {
      console.error(
        "REJECT RESULT ERROR:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
        code:
          error.code ||
          "RESULT_REJECTION_ERROR",
      });
    }
  }
);

router.get("/me", adminAuth, async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      admin: {
        id: req.admin.id,
        username: req.admin.username,
        ipAddress: req.admin.ipAddress,
      },
    });
  } catch (error) {
    console.error("GET ADMIN ME ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve admin information.",
    });
  }
});


router.post(
  "/players/:username/reset-registration",
  adminAuth,
  async (req, res) => {
    try {
      const username = req.params.username.trim().toLowerCase();

      const player = await prisma.player.findUnique({
        where: {
          username,
        },
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          message: "Player not found.",
        });
      }

      const result = await prisma.$transaction(async (tx) => {

        // Reset the player registration state
        const updatedPlayer = await tx.player.update({
          where: {
            id: player.id,
          },
          data: {
            status: "UNREGISTERED",
            passwordHash: null,
          },
        });

        // Remove old PENDING/REJECTED registration requests
        await tx.approvalRequest.deleteMany({
          where: {
            playerId: player.id,
            type: "REGISTRATION",
            status: {
              in: ["PENDING", "REJECTED"],
            },
          },
        });

        return updatedPlayer;
      });

      return res.status(200).json({
        success: true,
        message:
          "Player registration has been completely reset.",
        player: {
          id: result.id,
          username: result.username,
          status: result.status,
          passwordHash: result.passwordHash,
        },
      });

    } catch (error) {
      console.error(
        "RESET PLAYER REGISTRATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to reset player registration.",
      });
    }
  }
);


router.patch(
  "/players/:id/category",
  adminAuth,
  async (req, res) => {
    try {
      const playerId = Number(req.params.id);

      // Validate player ID
      if (!Number.isInteger(playerId) || playerId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid player ID.",
        });
      }

      const { category } = req.body;

      // Validate category
      if (
        typeof category !== "string" ||
        !category.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Player category is required.",
        });
      }

      const cleanCategory = category.trim().toLowerCase();

      // Prevent excessively long categories
      if (cleanCategory.length > 50) {
        return res.status(400).json({
          success: false,
          message: "Player category is too long.",
        });
      }

      // Find player
      const player = await prisma.player.findUnique({
        where: {
          id: playerId,
        },

        select: {
          id: true,
          username: true,
          fullName: true,
          category: true,
          status: true,
        },
      });

      if (!player) {
        return res.status(404).json({
          success: false,
          message: "Player not found.",
        });
      }

      // Prevent unnecessary update
      if (player.category === cleanCategory) {
        return res.status(409).json({
          success: false,
          message: `Player is already in the ${cleanCategory} category.`,
        });
      }

      // Update category
      const updatedPlayer = await prisma.player.update({
        where: {
          id: playerId,
        },

        data: {
          category: cleanCategory,
        },

        select: {
          id: true,
          username: true,
          fullName: true,
          category: true,
          status: true,
          updatedAt: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Player category changed successfully.",
        player: updatedPlayer,
      });

    } catch (error) {
      console.error(
        "CHANGE PLAYER CATEGORY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to change player category.",
      });
    }
  }
);

router.get(
  "/players",
  adminAuth,
  async (req, res) => {
    try {
      const players =
        await prisma.player.findMany({
          select: {
            id: true,
            username: true,
            fullName: true,
            category: true,
            status: true,
          },

          orderBy: {
            fullName: "asc",
          },
        });

      return res.status(200).json({
        success: true,
        count: players.length,
        players,
      });

    } catch (error) {
      console.error(
        "GET ADMIN PLAYERS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve players.",
      });
    }
  }
);

module.exports = router;
