const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");


function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded
      .split(",")[0]
      .trim();
  }

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

    /*
    |--------------------------------------------------------------------------
    | CHECK BLOCKED IP
    |--------------------------------------------------------------------------
    */

    if (await isBlockedIP(ipAddress)) {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | GET TOKEN
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | VERIFY TOKEN
    |--------------------------------------------------------------------------
    */

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
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


    /*
    |--------------------------------------------------------------------------
    | FIND ADMIN
    |--------------------------------------------------------------------------
    */

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


    /*
    |--------------------------------------------------------------------------
    | CHECK ADMIN STATUS
    |--------------------------------------------------------------------------
    */

    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Admin account is inactive.",
      });
    }


    /*
    |--------------------------------------------------------------------------
    | ATTACH ADMIN TO REQUEST
    |--------------------------------------------------------------------------
    */

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


