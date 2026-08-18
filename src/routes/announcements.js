const express = require("express");
const router = express.Router();

const prisma = require("../lib/prisma");

const adminAuth = require("../middleware/adminAuth");



function parsePage(value, fallback = 1) {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return fallback;
  }

  return page;
}

function parseLimit(value, fallback = 20) {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit < 1) {
    return fallback;
  }

  return Math.min(limit, 100);
}

function normalizeMessage(message) {
  if (typeof message !== "string") {
    return null;
  }

  const normalized = message.trim();

  if (!normalized) {
    return null;
  }

  return normalized;
}


router.get("/", async (req, res) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
    };

    const [announcements, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          message: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      prisma.announcement.count({
        where,
      }),
    ]);

    return res.json({
      success: true,
      announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET ANNOUNCEMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
    });
  }
});


router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await prisma.announcement.findFirst({
      where: {
        id,
        isActive: true,
      },
      select: {
        id: true,
        message: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    return res.json({
      success: true,
      announcement,
    });
  } catch (error) {
    console.error("GET ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcement",
    });
  }
});


router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    const status = req.query.status;

    const where = {};

    if (status === "active") {
      where.isActive = true;
    }

    if (status === "inactive") {
      where.isActive = false;
    }

    const skip = (page - 1) * limit;

    const [announcements, total] = await prisma.$transaction([
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.announcement.count({
        where,
      }),
    ]);

    return res.json({
      success: true,
      announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("ADMIN GET ANNOUNCEMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements",
    });
  }
});


router.post("/", adminAuth, async (req, res) => {
  try {
    const message = normalizeMessage(req.body?.message);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Announcement message is required",
      });
    }

    // Prevent extremely large announcements.
    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Announcement message is too long",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const announcement = await tx.announcement.create({
        data: {
          message,
          isActive: true,
        },
      });

      const players = await tx.player.findMany({
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
        },
      });

      if (players.length > 0) {
        await tx.notification.createMany({
          data: players.map((player) => ({
            playerId: player.id,
            type: "ANNOUNCEMENT",
            title: "New Announcement",
            message,
          })),
        });
      }

      return {
        announcement,
        notifiedPlayers: players.length,
      };
    });

    return res.status(201).json({
      success: true,
      message: "Announcement published successfully",
      announcement: result.announcement,
      notifiedPlayers: result.notifiedPlayers,
    });
  } catch (error) {
    console.error("CREATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create announcement",
    });
  }
});


router.put("/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const existing = await prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const data = {};

    if (req.body.message !== undefined) {
      const message = normalizeMessage(req.body.message);

      if (!message) {
        return res.status(400).json({
          success: false,
          message: "Announcement message cannot be empty",
        });
      }

      if (message.length > 5000) {
        return res.status(400).json({
          success: false,
          message: "Announcement message is too long",
        });
      }

      data.message = message;
    }

    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be a boolean",
        });
      }

      data.isActive = req.body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No changes supplied",
      });
    }

    const announcement = await prisma.announcement.update({
      where: {
        id,
      },
      data,
    });

    return res.json({
      success: true,
      message: "Announcement updated successfully",
      announcement,
    });
  } catch (error) {
    console.error("UPDATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update announcement",
    });
  }
});


router.patch("/:id/activate", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const updated = await prisma.announcement.update({
      where: {
        id,
      },
      data: {
        isActive: true,
      },
    });

    return res.json({
      success: true,
      message: "Announcement activated",
      announcement: updated,
    });
  } catch (error) {
    console.error("ACTIVATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to activate announcement",
    });
  }
});


router.patch("/:id/deactivate", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    const updated = await prisma.announcement.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });

    return res.json({
      success: true,
      message: "Announcement deactivated",
      announcement: updated,
    });
  } catch (error) {
    console.error("DEACTIVATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to deactivate announcement",
    });
  }
});

router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID",
      });
    }

    const announcement = await prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    await prisma.announcement.delete({
      where: {
        id,
      },
    });

    return res.json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("DELETE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement",
    });
  }
});

module.exports = router;

