const prisma = require("../lib/prisma");

async function createNotification({
  playerId,
  type,
  title,
  message,
}) {
  if (!playerId) {
    throw new Error("Player ID is required.");
  }

  if (!type) {
    throw new Error("Notification type is required.");
  }

  if (!title || typeof title !== "string") {
    throw new Error("Notification title is required.");
  }

  if (!message || typeof message !== "string") {
    throw new Error("Notification message is required.");
  }

  const notification = await prisma.notification.create({
    data: {
      playerId: Number(playerId),
      type,
      title: title.trim(),
      message: message.trim(),
    },
  });

  return notification;
}


async function getPlayerNotifications(
  playerId,
  options = {}
) {
  const {
    unreadOnly = false,
    limit = 50,
    skip = 0,
  } = options;

  const safeLimit = Math.min(
    Math.max(Number(limit) || 50, 1),
    100
  );

  const safeSkip = Math.max(
    Number(skip) || 0,
    0
  );

  const where = {
    playerId: Number(playerId),
  };

  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,

      orderBy: {
        createdAt: "desc",
      },

      skip: safeSkip,

      take: safeLimit,
    }),

    prisma.notification.count({
      where,
    }),
  ]);

  return {
    notifications,
    total,
    limit: safeLimit,
    skip: safeSkip,
  };
}


async function getUnreadCount(playerId) {
  const count = await prisma.notification.count({
    where: {
      playerId: Number(playerId),
      isRead: false,
    },
  });

  return count;
}


async function markAsRead(notificationId, playerId) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: Number(notificationId),
      playerId: Number(playerId),
    },
  });

  if (!notification) {
    return null;
  }

  if (notification.isRead) {
    return notification;
  }

  return prisma.notification.update({
    where: {
      id: notification.id,
    },

    data: {
      isRead: true,
    },
  });
}


async function markAllAsRead(playerId) {
  const result = await prisma.notification.updateMany({
    where: {
      playerId: Number(playerId),
      isRead: false,
    },

    data: {
      isRead: true,
    },
  });

  return {
    count: result.count,
  };
}


async function deleteNotification(
  notificationId,
  playerId
) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: Number(notificationId),
      playerId: Number(playerId),
    },
  });

  if (!notification) {
    return null;
  }

  await prisma.notification.delete({
    where: {
      id: notification.id,
    },
  });

  return notification;
}


async function deleteAllRead(playerId) {
  const result = await prisma.notification.deleteMany({
    where: {
      playerId: Number(playerId),
      isRead: true,
    },
  });

  return {
    count: result.count,
  };
}

router.get("/notifications", playerAuth, async (req, res) => {
  try {
    const playerId = Number(req.player.id);

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid player session.",
      });
    }

    const unreadOnly =
      req.query.unreadOnly === "true";

    const limit = req.query.limit || 50;
    const skip = req.query.skip || 0;

    const result =
      await notificationService.getPlayerNotifications(
        playerId,
        {
          unreadOnly,
          limit,
          skip,
        }
      );

    return res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error(
      "GET PLAYER NOTIFICATIONS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve notifications.",
    });
  }
});

router.get(
  "/notifications/unread-count",
  playerAuth,
  async (req, res) => {
    try {
      const playerId = Number(req.player.id);

      if (!Number.isInteger(playerId) || playerId <= 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid player session.",
        });
      }

      const count =
        await notificationService.getUnreadCount(
          playerId
        );

      return res.status(200).json({
        success: true,
        unreadCount: count,
      });

    } catch (error) {
      console.error(
        "GET UNREAD COUNT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve unread notification count.",
      });
    }
  }
);

router.patch(
  "/notifications/:id/read",
  playerAuth,
  async (req, res) => {
    try {
      const notificationId =
        Number(req.params.id);

      const playerId =
        Number(req.player.id);

      if (
        !Number.isInteger(notificationId) ||
        notificationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID.",
        });
      }

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid player session.",
        });
      }

      const notification =
        await notificationService.markAsRead(
          notificationId,
          playerId
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification marked as read.",
        notification,
      });

    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to mark notification as read.",
      });
    }
  }
);

router.patch(
  "/notifications/read-all",
  playerAuth,
  async (req, res) => {
    try {
      const playerId =
        Number(req.player.id);

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid player session.",
        });
      }

      const result =
        await notificationService.markAllAsRead(
          playerId
        );

      return res.status(200).json({
        success: true,
        message: "All notifications marked as read.",
        updated: result.count,
      });

    } catch (error) {
      console.error(
        "MARK ALL NOTIFICATIONS READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to mark notifications as read.",
      });
    }
  }
);

router.delete(
  "/notifications/:id",
  playerAuth,
  async (req, res) => {
    try {
      const notificationId =
        Number(req.params.id);

      const playerId =
        Number(req.player.id);

      if (
        !Number.isInteger(notificationId) ||
        notificationId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid notification ID.",
        });
      }

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid player session.",
        });
      }

      const notification =
        await notificationService.deleteNotification(
          notificationId,
          playerId
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: "Notification not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Notification deleted successfully.",
      });

    } catch (error) {
      console.error(
        "DELETE NOTIFICATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to delete notification.",
      });
    }
  }
);

router.delete(
  "/notifications/read",
  playerAuth,
  async (req, res) => {
    try {
      const playerId =
        Number(req.player.id);

      if (
        !Number.isInteger(playerId) ||
        playerId <= 0
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid player session.",
        });
      }

      const result =
        await notificationService.deleteAllRead(
          playerId
        );

      return res.status(200).json({
        success: true,
        message: "Read notifications deleted successfully.",
        deleted: result.count,
      });

    } catch (error) {
      console.error(
        "DELETE READ NOTIFICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to delete read notifications.",
      });
    }
  }
);

async function notifyPairingCreated(pairing) {
  try {
    if (!pairing) {
      throw new Error("Pairing is required.");
    }

    if (!pairing.whitePlayerId || !pairing.blackPlayerId) {
      throw new Error("Pairing must contain both players.");
    }

    const whiteName =
      pairing.whitePlayer?.fullName ||
      pairing.whitePlayer?.username ||
      "Opponent";

    const blackName =
      pairing.blackPlayer?.fullName ||
      pairing.blackPlayer?.username ||
      "Opponent";

    const mode =
      pairing.mode?.toString() || "GAME";

    const category =
      pairing.category || "GENERAL";

    const round =
      pairing.round ?? 0;


    // --------------------------------------------------------
    // WHITE PLAYER NOTIFICATION
    // --------------------------------------------------------

    const whiteNotification = prisma.notification.create({
      data: {
        playerId: pairing.whitePlayerId,

        type: "PAIRING",

        title: "New Pairing",

        message:
          `You have been paired against ${blackName} ` +
          `in Round ${round} (${mode}).`,
      },
    });


    // --------------------------------------------------------
    // BLACK PLAYER NOTIFICATION
    // --------------------------------------------------------

    const blackNotification = prisma.notification.create({
      data: {
        playerId: pairing.blackPlayerId,

        type: "PAIRING",

        title: "New Pairing",

        message:
          `You have been paired against ${whiteName} ` +
          `in Round ${round} (${mode}).`,
      },
    });


    const [whiteResult, blackResult] =
      await prisma.$transaction([
        whiteNotification,
        blackNotification,
      ]);


    return {
      success: true,

      pairingId: pairing.id,

      category,

      round,

      mode,

      notifications: [
        whiteResult,
        blackResult,
      ],
    };

  } catch (error) {
    console.error(
      "PAIRING NOTIFICATION ERROR:",
      error
    );

    throw error;
  }
}


module.exports = {
  createNotification,
  getPlayerNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  notifyPairingCreated,
  deleteNotification,
  deleteAllRead,
};

