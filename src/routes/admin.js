const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");
const { adminAuth } = require("../middleware/adminAuth");
const approvalService = require("../services/approvalService");
const ratingService = require("../services/ratingService");


router.get("/approvals", adminAuth, async (req, res) => {
  try {
    const approvals = await prisma.approvalRequest.findMany({
      where: {
        status: "PENDING",
      },

      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
            status: true,
            createdAt: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      count: approvals.length,
      approvals,
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

    /*
     * adminAuth should attach the authenticated admin
     * to req.admin.
     */
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


module.exports = router;
