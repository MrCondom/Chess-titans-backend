const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}


async function resultAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Authentication token has expired.",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    // ============================================================
    // ADMIN AUTHENTICATION
    // ============================================================

    if (decoded?.adminId) {
      const adminId = Number(decoded.adminId);

      if (!Number.isInteger(adminId) || adminId <= 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid admin identity.",
        });
      }

      const admin = await prisma.admin.findUnique({
        where: {
          id: adminId,
        },
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Admin account not found.",
        });
      }

      if (admin.status !== "ACTIVE") {
        return res.status(403).json({
          success: false,
          message: "Admin account is inactive.",
        });
      }

      req.admin = {
        id: admin.id,
        username: admin.username,
      };

      req.adminRecord = admin;
      req.isAdmin = true;

      return next();
    }

    // ============================================================
    // PLAYER AUTHENTICATION
    // ============================================================

    if (decoded?.playerId) {
      const playerId = Number(decoded.playerId);

      if (!Number.isInteger(playerId) || playerId <= 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid player identity.",
        });
      }

      if (decoded.type !== "player") {
        return res.status(401).json({
          success: false,
          message: "Invalid player authentication token.",
        });
      }

      const player = await prisma.player.findUnique({
        where: {
          id: playerId,
        },

        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
          category: true,
          bio: true,
        },
      });

      if (!player) {
        return res.status(401).json({
          success: false,
          message: "Player account not found.",
        });
      }

      req.player = player;
      req.playerId = player.id;
      req.playerToken = decoded;

      req.isAdmin = false;

      return next();
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });

  } catch (error) {
    console.error(
      "Result authentication middleware error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication service error.",
    });
  }
}

module.exports = resultAuth;