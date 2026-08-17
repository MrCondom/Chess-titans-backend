const prisma = require("../lib/prisma");

const {
  calculateRatingChange,
} = require("../utils/ratingCalculator");

const {
  getWinStreak,
  getLossStreak,
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



router.post("/record-result", async (req, res) => {
  try {
    let {
      white,
      black,
      result,
      ratings: mode = "rapid",
      round,
    } = req.body;

    white = String(white || "").trim().toLowerCase();
    black = String(black || "").trim().toLowerCase();

    mode = String(mode || "rapid").trim().toUpperCase();

    round = Number(round);

    if (!white || !black || !result || !round) {
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
      },
    });

    if (!pairing) {
      return res.status(404).json({
        success: false,
        message: `No such pairing found for Round ${round}.`,
      });
    }

    
    if (pairing.result !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "This match has already been recorded.",
      });
    }

   
    const parts = String(result)
      .split(":")
      .map((value) => Number(value));

    if (
      parts.length !== 2 ||
      !Number.isFinite(parts[0]) ||
      !Number.isFinite(parts[1])
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid score format. Example: 1:0 or 0.5:0.5",
      });
    }

    const scoreWhite = parts[0];
    const scoreBlack = parts[1];

    
    if (scoreWhite < 0 || scoreBlack < 0) {
      return res.status(400).json({
        success: false,
        message: "Scores cannot be negative.",
      });
    }

    if (scoreWhite === scoreBlack) {
      // Draw
    } else if (
      scoreWhite < scoreBlack
    ) {
      // Black wins
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

   
    let {
      changeA,
      changeB,
    } = calculateRatingChange(
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

    // Count this result
    if (scoreWhite > scoreBlack) {
      winStreakWhite++;
    } else if (scoreWhite < scoreBlack) {
      lossStreakWhite++;
    }

    if (scoreBlack > scoreWhite) {
      winStreakBlack++;
    } else if (scoreBlack < scoreWhite) {
      lossStreakBlack++;
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

    const gainField = getGainField(mode);

    const now = new Date();

    const transactionResult =
      await prisma.$transaction(async (tx) => {

        // Update white player
        const updatedWhite =
          await tx.player.update({
            where: {
              id: pairing.whitePlayerId,
            },

            data: {
              totalPoints: {
                increment: scoreWhite,
              },

              totalRounds: {
                increment: 1,
              },

              [gainField]: {
                increment: changeA,
              },
            },
          });

        // Update black player
        const updatedBlack =
          await tx.player.update({
            where: {
              id: pairing.blackPlayerId,
            },

            data: {
              totalPoints: {
                increment: scoreBlack,
              },

              totalRounds: {
                increment: 1,
              },

              [gainField]: {
                increment: changeB,
              },
            },
          });

        // Update pairing
        const updatedPairing =
          await tx.pairing.update({
            where: {
              id: pairing.id,
            },

            data: {
              result: pairingResult,

              whiteScore: scoreWhite,
              blackScore: scoreBlack,

              whiteChange: changeA,
              blackChange: changeB,

              playedAt: now,
            },

            include: {
              whitePlayer: true,
              blackPlayer: true,
            },
          });

        // White rating gain history
        await tx.ratingGain.create({
          data: {
            playerId: pairing.whitePlayerId,

            pairingId: pairing.id,

            mode,

            amount: changeA,

            reason: `Round ${round} result`,
          },
        });

        // Black rating gain history
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
          updatedPairing,
        };
      });

    
    return res.json({
      success: true,

      message:
        `Round ${round} result recorded successfully.`,

      result: {
        pairingId: pairing.id,

        round,

        mode: mode.toLowerCase(),

        white:
          transactionResult.updatedPairing.whitePlayer
            .username,

        black:
          transactionResult.updatedPairing.blackPlayer
            .username,

        whiteScore: scoreWhite,
        blackScore: scoreBlack,

        whiteChange: changeA,
        blackChange: changeB,

        result: pairingResult,

        playedAt: now,
      },
    });

  } catch (error) {

    console.error(
      "record-result error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});
