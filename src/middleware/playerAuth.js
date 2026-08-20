const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}


async function playerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // No Authorization header
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const parts = authHeader.trim().split(/\s+/);

    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
      });
    }

    const token = parts[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Authentication token has expired",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    if (!decoded || !decoded.playerId) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    
    if (decoded.type !== "player") {
      return res.status(401).json({
        success: false,
        message: "Invalid player authentication token",
      });
    }

    const playerId = Number(decoded.playerId);

    if (!Number.isInteger(playerId) || playerId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid player identity",
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
      },
    });

    // Token belongs to a player that no longer exists
    if (!player) {
      return res.status(401).json({
        success: false,
        message: "Player account not found",
      });
    }

    // Account has been disabled
    if (player.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Player account is inactive",
      });
    }

    // Attach authenticated player to request
    req.player = player;
    req.playerId = player.id;

    // Keep decoded token available if a route needs it.
    req.playerToken = decoded;

    next();
  } catch (error) {
    console.error("Player authentication middleware error:", error);

    return res.status(500).json({
      success: false,
      message: "Authentication service error",
    });
  }
}

module.exports = playerAuth;
