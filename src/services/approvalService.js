const prisma = require("../lib/prisma");


async function createApprovalRequest({
  playerId = null,
  type,
  data,
}) {
  if (!type) {
    throw new Error("Approval type is required");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Approval data must be an object");
  }

  // Prevent multiple pending requests of the same type
  // for the same player.
  if (playerId) {
    const existingRequest = await prisma.approvalRequest.findFirst({
      where: {
        playerId,
        type,
        status: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingRequest) {
      const error = new Error(
        "You already have a pending approval request of this type"
      );

      error.code = "PENDING_APPROVAL_EXISTS";

      throw error;
    }
  }

  const request = await prisma.approvalRequest.create({
    data: {
      playerId,
      type,
      status: "PENDING",
      data: JSON.stringify(data),
    },
  });

  return request;
}


async function getApprovalRequest(requestId) {
  const request = await prisma.approvalRequest.findUnique({
    where: {
      id: requestId,
    },
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
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
  });

  if (!request) {
    const error = new Error("Approval request not found");
    error.code = "APPROVAL_NOT_FOUND";

    throw error;
  }

  return request;
}


async function getPendingApprovals({
  page = 1,
  limit = 20,
  type = null,
} = {}) {
  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  // Never allow an unnecessarily large request.
  if (limit > 100) {
    limit = 100;
  }

  const where = {
    status: "PENDING",
  };

  if (type) {
    where.type = type;
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await prisma.$transaction([
    prisma.approvalRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "asc",
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            username: true,
            status: true,
            category: true,
          },
        },
      },
    }),

    prisma.approvalRequest.count({
      where,
    }),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}


async function getPlayerApprovalRequests(
  playerId,
  {
    page = 1,
    limit = 20,
  } = {}
) {
  page = Number(page);
  limit = Number(limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 20;
  }

  if (limit > 100) {
    limit = 100;
  }

  const skip = (page - 1) * limit;

  const where = {
    playerId,
  };

  const [requests, total] = await prisma.$transaction([
    prisma.approvalRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        type: true,
        status: true,
        reason: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),

    prisma.approvalRequest.count({
      where,
    }),
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function approveRequest(requestId, adminId) {
  const request = await prisma.approvalRequest.findUnique({
    where: {
      id: requestId,
    },
  });

  if (!request) {
    const error = new Error("Approval request not found");
    error.code = "APPROVAL_NOT_FOUND";

    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error(
      `Approval request has already been ${request.status.toLowerCase()}`
    );

    error.code = "APPROVAL_ALREADY_REVIEWED";

    throw error;
  }

  let data;

  try {
    data = JSON.parse(request.data);
  } catch (error) {
    const parseError = new Error(
      "Approval request contains invalid data"
    );

    parseError.code = "INVALID_APPROVAL_DATA";

    throw parseError;
  }

  const result = await prisma.$transaction(async (tx) => {
    let player = null;

    switch (request.type) {
      case "REGISTRATION":
        player = await approveRegistration(tx, request.playerId, data);
        break;

      case "BIO_CHANGE":
        player = await approveBioChange(
          tx,
          request.playerId,
          data
        );
        break;

      case "USERNAME_CHANGE":
        player = await approveUsernameChange(
          tx,
          request.playerId,
          data
        );
        break;

      case "PROFILE_CHANGE":
        player = await approveProfileChange(
          tx,
          request.playerId,
          data
        );
        break;

      case "PASSWORD_CHANGE":
        player = await approvePasswordChange(
          tx,
          request.playerId,
          data
        );
        break;

        case "RATING_CHANGE":
          player = await approveRatingChange(
            tx,
            request.playerId,
            data
          );
          break;

      default: {
        const error = new Error(
          `Unsupported approval type: ${request.type}`
        );

        error.code = "UNSUPPORTED_APPROVAL_TYPE";

        throw error;
      }
    }

    const updatedRequest = await tx.approvalRequest.update({
      where: {
        id: request.id,
      },
      data: {
        status: "APPROVED",
        adminId,
        reviewedAt: new Date(),
      },
    });

    return {
      request: updatedRequest,
      player,
    };
  });

  return result;
}


async function rejectRequest(requestId, adminId, reason = null) {
  const request = await prisma.approvalRequest.findUnique({
    where: {
      id: requestId,
    },
  });

  if (!request) {
    const error = new Error("Approval request not found");
    error.code = "APPROVAL_NOT_FOUND";

    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error(
      `Approval request has already been ${request.status.toLowerCase()}`
    );

    error.code = "APPROVAL_ALREADY_REVIEWED";

    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
  
    // If registration was rejected,
    // reset the player so they can register again.
    if (request.type === "REGISTRATION") {
      await tx.player.update({
        where: {
          id: request.playerId,
        },
        data: {
          status: "UNREGISTERED",
          passwordHash: null,
        },
      });
    }
  
    const updatedRequest =
      await tx.approvalRequest.update({
        where: {
          id: request.id,
        },
        data: {
          status: "REJECTED",
          adminId,
          reason:
            typeof reason === "string" &&
            reason.trim()
              ? reason.trim()
              : null,
          reviewedAt: new Date(),
        },
      });
  
    return updatedRequest;
  });
  
  return result;

  return updatedRequest;
}


async function approveRegistration(tx, playerId, data) {
  ensurePlayerId(playerId);

  if (!data || typeof data !== "object") {
    const error = new Error(
      "Registration approval data is invalid"
    );

    error.code = "INVALID_REGISTRATION_DATA";

    throw error;
  }

  const {
    bio = "",
    rapidRating = 0,
    blitzRating = 0,
    bulletRating = 0,
    passwordHash,
  } = data;

  // Password hash is mandatory for registration approval.
  if (
    typeof passwordHash !== "string" ||
    !passwordHash.trim()
  ) {
    const error = new Error(
      "Registration approval data is missing password hash"
    );

    error.code = "INVALID_REGISTRATION_DATA";

    throw error;
  }

  // Get the existing administrator-created player.
  const player = await tx.player.findUnique({
    where: {
      id: playerId,
    },
  });

  if (!player) {
    const error = new Error(
      "Player account not found"
    );

    error.code = "PLAYER_NOT_FOUND";

    throw error;
  }

  if (player.status === "ACTIVE") {
    const error = new Error(
      "Player account is already active"
    );

    error.code = "PLAYER_ALREADY_ACTIVE";

    throw error;
  }

  // The username already belongs to this player,
  // so there is no need to take it from approval data.
  return tx.player.update({
    where: {
      id: playerId,
    },

    data: {
      // Existing administrator-created information
      // remains unchanged:
      // fullName
      // username
      // category

      bio:
        typeof bio === "string"
          ? bio.trim()
          : "",

      passwordHash,

      rapidRating:
        Number.isInteger(rapidRating)
          ? rapidRating
          : 0,

      blitzRating:
        Number.isInteger(blitzRating)
          ? blitzRating
          : 0,

      bulletRating:
        Number.isInteger(bulletRating)
          ? bulletRating
          : 0,

      status: "ACTIVE",
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
}


async function approveBioChange(tx, playerId, data) {
  ensurePlayerId(playerId);

  if (typeof data.bio !== "string") {
    const error = new Error("Invalid bio data");
    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  return updateExistingPlayer(
    tx,
    playerId,
    {
      bio: data.bio.trim(),
    }
  );
}


async function approveUsernameChange(tx, playerId, data) {
  ensurePlayerId(playerId);

  if (typeof data.username !== "string") {
    const error = new Error("Invalid username data");
    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  const username = normalizeUsername(data.username);

  const existingPlayer = await tx.player.findFirst({
    where: {
      username,
      NOT: {
        id: playerId,
      },
    },
  });

  if (existingPlayer) {
    const error = new Error(
      "Username is already in use"
    );

    error.code = "USERNAME_ALREADY_EXISTS";

    throw error;
  }

  return updateExistingPlayer(
    tx,
    playerId,
    {
      username,
    }
  );
}


async function approveProfileChange(tx, playerId, data) {
  ensurePlayerId(playerId);

  const updateData = {};

  if (data.fullName !== undefined) {
    if (
      typeof data.fullName !== "string" ||
      !data.fullName.trim()
    ) {
      const error = new Error("Invalid full name");
      error.code = "INVALID_APPROVAL_DATA";

      throw error;
    }

    updateData.fullName = data.fullName.trim();
  }

  if (data.category !== undefined) {
    if (typeof data.category !== "string") {
      const error = new Error("Invalid category");
      error.code = "INVALID_APPROVAL_DATA";

      throw error;
    }

    updateData.category = data.category.trim();
  }

  if (Object.keys(updateData).length === 0) {
    const error = new Error(
      "No valid profile changes supplied"
    );

    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  return updateExistingPlayer(
    tx,
    playerId,
    updateData
  );
}


async function approveRatingChange(tx, playerId, data) {
  ensurePlayerId(playerId);

  const updateData = {};

  if (data.rapidRating !== undefined) {
    if (!Number.isInteger(data.rapidRating)) {
      throw new Error("Invalid rapid rating");
    }

    updateData.rapidRating = data.rapidRating;
  }

  if (data.blitzRating !== undefined) {
    if (!Number.isInteger(data.blitzRating)) {
      throw new Error("Invalid blitz rating");
    }

    updateData.blitzRating = data.blitzRating;
  }

  if (data.bulletRating !== undefined) {
    if (!Number.isInteger(data.bulletRating)) {
      throw new Error("Invalid bullet rating");
    }

    updateData.bulletRating = data.bulletRating;
  }

  if (Object.keys(updateData).length === 0) {
    const error = new Error("No valid rating changes supplied");
    error.code = "INVALID_APPROVAL_DATA";
    throw error;
  }

  return updateExistingPlayer(
    tx,
    playerId,
    updateData
  );
}


async function approvePasswordChange(tx, playerId, data) {
  ensurePlayerId(playerId);

  if (
    typeof data.passwordHash !== "string" ||
    !data.passwordHash
  ) {
    const error = new Error(
      "Invalid password data"
    );

    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  return updateExistingPlayer(
    tx,
    playerId,
    {
      passwordHash: data.passwordHash,
    }
  );
}


async function updateExistingPlayer(tx, playerId, data) {
  const player = await tx.player.findUnique({
    where: {
      id: playerId,
    },
  });

  if (!player) {
    const error = new Error("Player account not found");
    error.code = "PLAYER_NOT_FOUND";

    throw error;
  }

  return tx.player.update({
    where: {
      id: playerId,
    },
    data,
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
}

function ensurePlayerId(playerId) {
  const id = Number(playerId);

  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error("Valid player ID is required");
    error.code = "INVALID_PLAYER_ID";

    throw error;
  }
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

async function editApprovalRequest(
  requestId,
  data
) {
  const request = await prisma.approvalRequest.findUnique({
    where: {
      id: Number(requestId),
    },
  });

  if (!request) {
    const error = new Error(
      "Approval request not found"
    );

    error.code = "APPROVAL_NOT_FOUND";

    throw error;
  }

  if (request.status !== "PENDING") {
    const error = new Error(
      "Only pending approval requests can be edited"
    );

    error.code = "APPROVAL_NOT_PENDING";

    throw error;
  }

  if (!data || typeof data !== "object") {
    const error = new Error(
      "Approval data must be an object"
    );

    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  let currentData = {};

  try {
    currentData = JSON.parse(request.data);
  } catch {
    const error = new Error(
      "Approval request contains invalid data"
    );

    error.code = "INVALID_APPROVAL_DATA";

    throw error;
  }

  /*
   * Only allow fields that are appropriate
   * for the approval type.
   */

  let updatedData = {
    ...currentData,
  };

  switch (request.type) {
    case "REGISTRATION":
    case "PROFILE_CHANGE": {

      if (data.fullName !== undefined) {
        if (
          typeof data.fullName !== "string" ||
          !data.fullName.trim()
        ) {
          throw new Error(
            "Full name must be a valid string"
          );
        }

        updatedData.fullName =
          data.fullName.trim();
      }

      if (data.username !== undefined) {
        if (
          typeof data.username !== "string" ||
          !data.username.trim()
        ) {
          throw new Error(
            "Username must be a valid string"
          );
        }

        updatedData.username =
          normalizeUsername(data.username);
      }

      if (data.category !== undefined) {
        if (typeof data.category !== "string") {
          throw new Error(
            "Category must be a string"
          );
        }

        updatedData.category =
          data.category.trim();
      }

      if (data.bio !== undefined) {
        if (typeof data.bio !== "string") {
          throw new Error(
            "Bio must be a string"
          );
        }

        updatedData.bio =
          data.bio.trim();
      }

      if (data.rapidRating !== undefined) {
        if (!Number.isInteger(data.rapidRating)) {
          throw new Error(
            "Rapid rating must be an integer"
          );
        }

        updatedData.rapidRating =
          data.rapidRating;
      }

      if (data.blitzRating !== undefined) {
        if (!Number.isInteger(data.blitzRating)) {
          throw new Error(
            "Blitz rating must be an integer"
          );
        }

        updatedData.blitzRating =
          data.blitzRating;
      }

      if (data.bulletRating !== undefined) {
        if (!Number.isInteger(data.bulletRating)) {
          throw new Error(
            "Bullet rating must be an integer"
          );
        }

        updatedData.bulletRating =
          data.bulletRating;
      }

      break;
    }

    case "BIO_CHANGE": {

      if (data.bio !== undefined) {
        if (typeof data.bio !== "string") {
          throw new Error(
            "Bio must be a string"
          );
        }

        updatedData.bio =
          data.bio.trim();
      }

      break;
    }

    case "USERNAME_CHANGE": {

      if (data.username !== undefined) {
        if (
          typeof data.username !== "string" ||
          !data.username.trim()
        ) {
          throw new Error(
            "Username must be a valid string"
          );
        }

        updatedData.username =
          normalizeUsername(data.username);
      }

      break;
    }

    case "RATING_CHANGE": {

      if (data.rapidRating !== undefined) {
        if (!Number.isInteger(data.rapidRating)) {
          throw new Error(
            "Invalid rapid rating"
          );
        }

        updatedData.rapidRating =
          data.rapidRating;
      }

      if (data.blitzRating !== undefined) {
        if (!Number.isInteger(data.blitzRating)) {
          throw new Error(
            "Invalid blitz rating"
          );
        }

        updatedData.blitzRating =
          data.blitzRating;
      }

      if (data.bulletRating !== undefined) {
        if (!Number.isInteger(data.bulletRating)) {
          throw new Error(
            "Invalid bullet rating"
          );
        }

        updatedData.bulletRating =
          data.bulletRating;
      }

      break;
    }

    default: {
      const error = new Error(
        `Approval type ${request.type} cannot be edited`
      );

      error.code =
        "UNSUPPORTED_APPROVAL_EDIT";

      throw error;
    }
  }

  return prisma.approvalRequest.update({
    where: {
      id: request.id,
    },

    data: {
      data: JSON.stringify(updatedData),
    },

    include: {
      player: {
        select: {
          id: true,
          fullName: true,
          username: true,
          status: true,
          category: true,
          bio: true,
        },
      },
    },
  });
}

module.exports = {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  getPlayerApprovalRequests,
  approveRequest,
  rejectRequest,
  editApprovalRequest
};