const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  
  return (
    req.socket?.remoteAddress ||
    req.ip ||
    ""
  );
}

async function isBlockedIP(ipAddress) {
  if (!ipAddress) {
    return false;
  }

  const blocked = await prisma.blockedIP.findUnique({
    where: {
      ipAddress,
    },
  });

  return Boolean(
    blocked &&
    blocked.isBlocked
  );
}


async function adminAuth(req, res, next) {
  try {
    const ipAddress = getClientIp(req);


    if (await isBlockedIP(ipAddress)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }


    const authHeader =
      req.headers.authorization || "";

    if (
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }


    const token =
      authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }


    let decoded;

    try {
      decoded = jwt.verify(
        token,
        JWT_SECRET
      );
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }


    if (
      !decoded ||
      !decoded.adminId
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }


    const admin =
      await prisma.admin.findUnique({
        where: {
          id: Number(decoded.adminId),
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
      ipAddress,
    };

    req.adminRecord = admin;

    next();

  } catch (error) {
    console.error(
      "adminAuth error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authentication error.",
    });
  }
}

module.exports = {
  adminAuth,
  getClientIp,
  isBlockedIP,
};


    