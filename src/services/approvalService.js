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

  const updatedRequest = await prisma.approvalRequest.update({
    where: {
      id: request.id,
    },
    data: {
      status: "REJECTED",
      adminId,
      reason:
        typeof reason === "string" && reason.trim()
          ? reason.trim()
          : null,
      reviewedAt: new Date(),
    },
  });

  return updatedRequest;
}


async function approveRegistration(tx, playerId, data) {
  ensurePlayerId(playerId);
  const {
    fullName,
    username,
    passwordHash,
    category = "",
    bio = "",
  } = data;

  if (!fullName || !username || !passwordHash) {
    const error = new Error(
      "Registration approval data is incomplete"
    );

    error.code = "INVALID_REGISTRATION_DATA";

    throw error;
  }

  const normalizedUsername = normalizeUsername(username);

  const existingPlayer = await tx.player.findUnique({
    where: {
      username: normalizedUsername,
    },
  });

  if (existingPlayer) {
    const error = new Error(
      "Username is already in use"
    );

    error.code = "USERNAME_ALREADY_EXISTS";

    throw error;
  }

  return tx.player.create({
    data: {
      fullName: fullName.trim(),
      username: normalizedUsername,
      passwordHash,
      category: typeof category === "string" ? category.trim() : "",
      bio: typeof bio === "string" ? bio.trim() : "",
      status: "ACTIVE",
    },
    select: {
      id: true,
      fullName: true,
      username: true,
      status: true,
      category: true,
      bio: true,
      createdAt: true,
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
      currentChampionTitle: true,
      championshipWins: true,
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

module.exports = {
  createApprovalRequest,
  getApprovalRequest,
  getPendingApprovals,
  getPlayerApprovalRequests,
  approveRequest,
  rejectRequest,
};