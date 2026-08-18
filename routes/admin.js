const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = require("../lib/prisma");

const router = express.Router();

const {
  adminAuth,
  getClientIp,
  isBlockedIP,
} = require("../middleware/adminAuth");

const {
  calculateRatingChange,
} = require("../utils/ratingCalculator");

const {
  getWinMultiplier,
  getLossMultiplier,
} = require("../utils/streak");



function getPlayerRating(player, mode) {
  switch (mode) {
    case "RAPID":
      return player.rapidRating || 0;

    case "BLITZ":
      return player.blitzRating || 0;

    case "BULLET":
      return player.bulletRating || 0;

    default:
      return 0;
  }
}

function getGainField(mode) {
  switch (mode) {
    case "RAPID":
      return "rapidGain";

    case "BLITZ":
      return "blitzGain";

    case "BULLET":
      return "bulletGain";

    default:
      throw new Error("Invalid game mode");
  }
}

function getPlayerStreaks(
  gains,
  playerId,
  category,
  mode
) {
  const playerGains = gains
    .filter(
      (gain) =>
        gain.playerId === playerId &&
        gain.mode === mode &&
        gain.pairing?.category === category
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt) -
        new Date(b.createdAt)
    );

  let win = 0;
  let loss = 0;

  for (
    let i = playerGains.length - 1;
    i >= 0;
    i--
  ) {
    const gain = playerGains[i];

    if (gain.amount > 0) {
      win++;
      loss = 0;
    } else if (gain.amount < 0) {
      loss++;
      win = 0;
    } else {
      break;
    }
  }

  return {
    win,
    loss,
  };
}

router.post("/login", async (req, res) => {
  try {
    const username =
      String(
        req.body.username || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        req.body.password || ""
      );


    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Username and password are required.",
      });
    }


    const ipAddress =
      getClientIp(req);


    if (
      await isBlockedIP(
        ipAddress
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied.",
      });
    }


    const admin =
      await prisma.admin.findUnique({
        where: {
          username,
        },
      });


    if (!admin) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid username or password.",
      });
    }


    if (
      admin.status !== "ACTIVE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Admin account is inactive.",
      });
    }

    const passwordValid =
      await bcrypt.compare(
        password,
        admin.passwordHash
      );


    if (!passwordValid) {
      await prisma.adminLoginLog.create({
        data: {
          adminId: admin.id,
          ipAddress,
          successful: false,
        },
      });

      return res.status(401).json({
        success: false,
        message:
          "Invalid username or password.",
      });
    }


    const now = new Date();


    await prisma.$transaction([
      prisma.admin.update({
        where: {
          id: admin.id,
        },

        data: {
          ipAddress,
          lastLoginAt: now,
        },
      }),

      prisma.adminLoginLog.create({
        data: {
          adminId: admin.id,
          ipAddress,
          successful: true,
          loginAt: now,
        },
      }),
    ]);


    if (!process.env.JWT_SECRET) {
      console.error(
        "JWT_SECRET is not configured."
      );

      return res.status(500).json({
        success: false,
        message:
          "Authentication configuration error.",
      });
    }


    const token =
      jwt.sign(
        {
          adminId: admin.id,
          username: admin.username,
        },

        process.env.JWT_SECRET,

        {
          expiresIn:
            process.env.JWT_EXPIRES_IN ||
            "7d",
        }
      );


    return res.json({
      success: true,

      message:
        "Admin login successful.",

      token,

      admin: {
        id: admin.id,
        username: admin.username,
        status: admin.status,
        ipAddress,
        lastLoginAt: now,
      },
    });

  } catch (error) {
    console.error(
      "admin login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to login.",
    });
  }
});


router.get(
  "/me",
  adminAuth,
  async (req, res) => {
    try {
      const admin =
        await prisma.admin.findUnique({
          where: {
            id: req.admin.id,
          },

          select: {
            id: true,
            username: true,
            ipAddress: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        });


      if (!admin) {
        return res.status(404).json({
          success: false,
          message:
            "Admin account not found.",
        });
      }


      return res.json({
        success: true,
        admin,
      });

    } catch (error) {
      console.error(
        "get admin profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load admin profile.",
      });
    }
  }
);


router.post(
  "/logout",
  adminAuth,
  async (req, res) => {
    return res.json({
      success: true,
      message:
        "Logged out successfully.",
    });
  }
);


router.post(
  "/blocked-ips",
  adminAuth,
  async (req, res) => {
    try {
      const ipAddress =
        String(
          req.body.ipAddress || ""
        ).trim();


      if (!ipAddress) {
        return res.status(400).json({
          success: false,
          message:
            "IP address is required.",
        });
      }


      const existing =
        await prisma.blockedIP.findUnique({
          where: {
            ipAddress,
          },
        });


      if (existing) {
        const updated =
          await prisma.blockedIP.update({
            where: {
              ipAddress,
            },

            data: {
              isBlocked: true,
              blockedAt: new Date(),
              unblockedAt: null,
            },
          });

        return res.json({
          success: true,
          message:
            "IP address blocked successfully.",
          blockedIP: updated,
        });
      }


      const blocked =
        await prisma.blockedIP.create({
          data: {
            ipAddress,
            isBlocked: true,
          },
        });


      return res.status(201).json({
        success: true,
        message:
          "IP address blocked successfully.",
        blockedIP: blocked,
      });

    } catch (error) {
      console.error(
        "block IP error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to block IP address.",
      });
    }
  }
);

router.patch(
  "/blocked-ips/:ipAddress/unblock",
  adminAuth,
  async (req, res) => {
    try {
      const ipAddress =
        String(
          req.params.ipAddress || ""
        ).trim();


      const blocked =
        await prisma.blockedIP.findUnique({
          where: {
            ipAddress,
          },
        });


      if (!blocked) {
        return res.status(404).json({
          success: false,
          message:
            "IP address not found.",
        });
      }


      const updated =
        await prisma.blockedIP.update({
          where: {
            ipAddress,
          },

          data: {
            isBlocked: false,
            unblockedAt:
              new Date(),
          },
        });


      return res.json({
        success: true,
        message:
          "IP address unblocked successfully.",
        blockedIP: updated,
      });

    } catch (error) {
      console.error(
        "unblock IP error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to unblock IP address.",
      });
    }
  }
);

router.get(
  "/blocked-ips",
  adminAuth,
  async (req, res) => {
    try {
      const blockedIPs =
        await prisma.blockedIP.findMany({
          orderBy: {
            blockedAt: "desc",
          },
        });


      return res.json({
        success: true,
        blockedIPs,
      });

    } catch (error) {
      console.error(
        "get blocked IPs error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load blocked IPs.",
      });
    }
  }
);

router.get(
  "/login-logs",
  adminAuth,
  async (req, res) => {
    try {
      const logs =
        await prisma.adminLoginLog.findMany({
          include: {
            admin: {
              select: {
                id: true,
                username: true,
              },
            },
          },

          orderBy: {
            loginAt: "desc",
          },

          take: 200,
        });


      return res.json({
        success: true,
        logs,
      });

    } catch (error) {
      console.error(
        "get login logs error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load login logs.",
      });
    }
  }
);


router.get(
  "/admins",
  adminAuth,
  async (req, res) => {
    try {
      const admins =
        await prisma.admin.findMany({
          select: {
            id: true,
            username: true,
            ipAddress: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
          },

          orderBy: {
            id: "asc",
          },
        });


      return res.json({
        success: true,
        admins,
      });

    } catch (error) {
      console.error(
        "get admins error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load admins.",
      });
    }
  }
);


router.patch(
  "/admins/:id/status",
  adminAuth,
  async (req, res) => {
    try {
      const adminId =
        Number(req.params.id);

      const status =
        String(
          req.body.status || ""
        )
          .trim()
          .toUpperCase();


      if (!Number.isInteger(adminId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid admin ID.",
        });
      }


      if (
        !["ACTIVE", "INACTIVE"]
          .includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be ACTIVE or INACTIVE.",
        });
      }

      if (
        adminId === req.admin.id &&
        status === "INACTIVE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot deactivate your own account.",
        });
      }


      const admin =
        await prisma.admin.update({
          where: {
            id: adminId,
          },

          data: {
            status,
          },

          select: {
            id: true,
            username: true,
            status: true,
          },
        });


      return res.json({
        success: true,
        message:
          "Admin status updated successfully.",
        admin,
      });

    } catch (error) {
      console.error(
        "update admin status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update admin status.",
      });
    }
  }
);


router.post("/record-result", adminAuth, async (req, res) => {
  try {
    let {
      white,
      black,
      result,
      mode = "rapid",
      ratings, // backward compatibility with old frontend
      round,
    } = req.body;

    // Support old frontend sending "ratings"
    if (!req.body.mode && ratings !== undefined) {
      mode = ratings;
    }

    white = String(white || "").trim().toLowerCase();
    black = String(black || "").trim().toLowerCase();

    mode = String(mode || "rapid").trim().toUpperCase();

    round = Number(round);

    if (!white || !black || !result || !Number.isInteger(round)) {
      return res.status(400).json({
        success: false,
        message: "white, black, result and round are required.",
      });
    }

    if (!["RAPID", "BLITZ", "BULLET"].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }


    const pairing = await prisma.pairing.findFirst({
      where: {
        round,
        mode,

        whitePlayer: {
          username: white,
        },

        blackPlayer: {
          username: black,
        },
      },

      include: {
        whitePlayer: true,
        blackPlayer: true,
        result: true,
      },
    });

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: `No such pairing found for Round ${round}.`,
      });
    }

    if (pairing.result) {
      return res.status(400).json({
        success: false,
        message: "This match has already been recorded.",
      });
    }


    const parts = String(result)
      .trim()
      .split(":")
      .map((value) => Number(value));

    if (
      parts.length !== 2 ||
      !Number.isFinite(parts[0]) ||
      !Number.isFinite(parts[1])
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid score format. Use 1:0, 0:1 or 0.5:0.5.",
      });
    }

    const scoreWhite = parts[0];
    const scoreBlack = parts[1];


    const validResult =
      (scoreWhite === 1 && scoreBlack === 0) ||
      (scoreWhite === 0 && scoreBlack === 1) ||
      (scoreWhite === 0.5 && scoreBlack === 0.5);

    if (!validResult) {
      return res.status(400).json({
        success: false,
        message: "Invalid result. Use 1:0, 0:1 or 0.5:0.5.",
      });
    }


    let pairingResult;

    if (scoreWhite > scoreBlack) {
      pairingResult = "WHITE_WIN";
    } else if (scoreBlack > scoreWhite) {
      pairingResult = "BLACK_WIN";
    } else {
      pairingResult = "DRAW";
    }


    const whiteRating = getPlayerRating(
      pairing.whitePlayer,
      mode
    );

    const blackRating = getPlayerRating(
      pairing.blackPlayer,
      mode
    );

    const previousGains = await prisma.ratingGain.findMany({
      where: {
        mode,

        playerId: {
          in: [
            pairing.whitePlayerId,
            pairing.blackPlayerId,
          ],
        },
      },

      orderBy: {
        createdAt: "asc",
      },

      include: {
        pairing: true,
      },
    });


    let { changeA, changeB } = calculateRatingChange(
      whiteRating,
      blackRating,
      scoreWhite,
      scoreBlack
    );


    const whiteStreaks = getPlayerStreaks(
      previousGains,
      pairing.whitePlayerId,
      pairing.category,
      mode
    );

    const blackStreaks = getPlayerStreaks(
      previousGains,
      pairing.blackPlayerId,
      pairing.category,
      mode
    );

    let winStreakWhite = whiteStreaks.win;
    let lossStreakWhite = whiteStreaks.loss;

    let winStreakBlack = blackStreaks.win;
    let lossStreakBlack = blackStreaks.loss;


    if (scoreWhite > scoreBlack) {
      winStreakWhite++;
      lossStreakWhite = 0;
    } else if (scoreWhite < scoreBlack) {
      lossStreakWhite++;
      winStreakWhite = 0;
    }

    if (scoreBlack > scoreWhite) {
      winStreakBlack++;
      lossStreakBlack = 0;
    } else if (scoreBlack < scoreWhite) {
      lossStreakBlack++;
      winStreakBlack = 0;
    }


    const winMultWhite =
      getWinMultiplier(winStreakWhite);

    const lossMultWhite =
      getLossMultiplier(lossStreakWhite);

    const winMultBlack =
      getWinMultiplier(winStreakBlack);

    const lossMultBlack =
      getLossMultiplier(lossStreakBlack);


    if (changeA > 0) {
      changeA = Math.round(
        changeA *
          winMultWhite *
          lossMultWhite
      );
    } else if (changeA < 0) {
      changeA = Math.round(
        changeA *
          lossMultWhite
      );
    }

    if (changeB > 0) {
      changeB = Math.round(
        changeB *
          winMultBlack *
          lossMultBlack
      );
    } else if (changeB < 0) {
      changeB = Math.round(
        changeB *
          lossMultBlack
      );
    }


    const ratingField = {
      RAPID: "rapidRating",
      BLITZ: "blitzRating",
      BULLET: "bulletRating",
    }[mode];

    const gainField = getGainField(mode);

    const now = new Date();


    const transactionResult =
      await prisma.$transaction(async (tx) => {


        const updatedWhite =
          await tx.player.update({
            where: {
              id: pairing.whitePlayerId,
            },

            data: {
              [ratingField]: {
                increment: changeA,
              },

              [gainField]: {
                increment: changeA,
              },

              totalPoints: {
                increment: scoreWhite,
              },

              totalRounds: {
                increment: 1,
              },
            },
          });


        const updatedBlack =
          await tx.player.update({
            where: {
              id: pairing.blackPlayerId,
            },

            data: {
              [ratingField]: {
                increment: changeB,
              },

              [gainField]: {
                increment: changeB,
              },

              totalPoints: {
                increment: scoreBlack,
              },

              totalRounds: {
                increment: 1,
              },
            },
          });


        const gameResult =
          await tx.gameResult.create({
            data: {
              round,
              mode,

              whitePlayerId:
                pairing.whitePlayerId,

              blackPlayerId:
                pairing.blackPlayerId,

              whiteScore: scoreWhite,
              blackScore: scoreBlack,

              whiteRatingChange: changeA,
              blackRatingChange: changeB,

              category: pairing.category,

              date: now,

              pairingId: pairing.id,
            },

            include: {
              whitePlayer: true,
              blackPlayer: true,
              pairing: true,
            },
          });

       
        await tx.ratingGain.create({
          data: {
            playerId: pairing.whitePlayerId,

            pairingId: pairing.id,

            mode,

            amount: changeA,

            reason: `Round ${round} result`,
          },
        });


        await tx.ratingGain.create({
          data: {
            playerId: pairing.blackPlayerId,

            pairingId: pairing.id,

            mode,

            amount: changeB,

            reason: `Round ${round} result`,
          },
        });

        return {
          updatedWhite,
          updatedBlack,
          gameResult,
        };
      });


    return res.json({
      success: true,

      message:
        `Round ${round} result recorded successfully.`,

      result: {
        id:
          transactionResult.gameResult.id,

        pairingId:
          pairing.id,

        round,

        mode: mode.toLowerCase(),

        category:
          pairing.category,

        white:
          transactionResult.gameResult
            .whitePlayer.username,

        black:
          transactionResult.gameResult
            .blackPlayer.username,

        whiteScore:
          scoreWhite,

        blackScore:
          scoreBlack,

        whiteChange:
          changeA,

        blackChange:
          changeB,

        result:
          pairingResult,

        playedAt:
          now,
      },
    });

  } catch (error) {
    console.error(
      "record-result error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to record result.",
    });
  }
});

router.get(
  "/rating-gains/player/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const playerId =
        Number(req.params.playerId);

      if (!Number.isInteger(playerId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid player ID.",
        });
      }


      const player =
        await prisma.player.findUnique({
          where: {
            id: playerId,
          },

          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,
            rapidRating: true,
            blitzRating: true,
            bulletRating: true,
          },
        });


      if (!player) {
        return res.status(404).json({
          success: false,
          message:
            "Player not found.",
        });
      }


      const gains =
        await prisma.ratingGain.findMany({
          where: {
            playerId,
          },

          include: {
            pairing: {
              select: {
                id: true,
                category: true,
                round: true,
                mode: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },
        });


      return res.json({
        success: true,

        player,

        gains,
      });

    } catch (error) {
      console.error(
        "get player rating gains error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load rating gains.",
      });
    }
  }
);


router.get(
  "/rating-gains",
  adminAuth,
  async (req, res) => {
    try {
      const playerId =
        req.query.playerId
          ? Number(req.query.playerId)
          : undefined;

      const mode =
        req.query.mode
          ? String(
              req.query.mode
            )
              .trim()
              .toUpperCase()
          : undefined;


      if (
        playerId !== undefined &&
        !Number.isInteger(playerId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid player ID.",
        });
      }


      if (
        mode &&
        ![
          "RAPID",
          "BLITZ",
          "BULLET",
        ].includes(mode)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid game mode.",
        });
      }


      const gains =
        await prisma.ratingGain.findMany({
          where: {
            ...(playerId !== undefined
              ? { playerId }
              : {}),

            ...(mode
              ? { mode }
              : {}),
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

            pairing: {
              select: {
                id: true,
                category: true,
                round: true,
                mode: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          take: 500,
        });


      return res.json({
        success: true,

        filters: {
          playerId:
            playerId ?? null,

          mode:
            mode
              ? mode.toLowerCase()
              : null,
        },

        gains,
      });

    } catch (error) {
      console.error(
        "get rating gains error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load rating gains.",
      });
    }
  }
);


router.get(
  "/rating-gains/summary/:playerId",
  adminAuth,
  async (req, res) => {
    try {
      const playerId =
        Number(req.params.playerId);


      if (!Number.isInteger(playerId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid player ID.",
        });
      }


      const player =
        await prisma.player.findUnique({
          where: {
            id: playerId,
          },

          select: {
            id: true,
            fullName: true,
            username: true,
            category: true,

            rapidRating: true,
            blitzRating: true,
            bulletRating: true,

            rapidGain: true,
            blitzGain: true,
            bulletGain: true,
          },
        });


      if (!player) {
        return res.status(404).json({
          success: false,
          message:
            "Player not found.",
        });
      }


      const gains =
        await prisma.ratingGain.findMany({
          where: {
            playerId,
          },

          select: {
            mode: true,
            amount: true,
            createdAt: true,
          },

          orderBy: {
            createdAt: "asc",
          },
        });


      const summary = {
        RAPID: {
          games: 0,
          gain: 0,
        },

        BLITZ: {
          games: 0,
          gain: 0,
        },

        BULLET: {
          games: 0,
          gain: 0,
        },
      };


      for (const gain of gains) {
        summary[gain.mode].games++;

        summary[gain.mode].gain +=
          gain.amount;
      }


      return res.json({
        success: true,

        player,

        summary: {
          rapid: summary.RAPID,
          blitz: summary.BLITZ,
          bullet: summary.BULLET,
        },
      });

    } catch (error) {
      console.error(
        "rating gain summary error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load rating gain summary.",
      });
    }
  }
);


module.exports = router
