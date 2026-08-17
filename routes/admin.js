const express = require("express")
const prisma = require("../lib/prisma");
const router = express.Router();

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



router.post("/record-result", async (req, res) => {
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

    /*
    |--------------------------------------------------------------------------
    | FIND PAIRING
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | CHECK IF RESULT ALREADY EXISTS
    |--------------------------------------------------------------------------
    */

    if (pairing.result) {
      return res.status(400).json({
        success: false,
        message: "This match has already been recorded.",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PARSE RESULT
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | VALIDATE CHESS RESULT
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | DETERMINE RESULT
    |--------------------------------------------------------------------------
    */

    let pairingResult;

    if (scoreWhite > scoreBlack) {
      pairingResult = "WHITE_WIN";
    } else if (scoreBlack > scoreWhite) {
      pairingResult = "BLACK_WIN";
    } else {
      pairingResult = "DRAW";
    }

    /*
    |--------------------------------------------------------------------------
    | GET CURRENT RATINGS
    |--------------------------------------------------------------------------
    */

    const whiteRating = getPlayerRating(
      pairing.whitePlayer,
      mode
    );

    const blackRating = getPlayerRating(
      pairing.blackPlayer,
      mode
    );

    /*
    |--------------------------------------------------------------------------
    | GET PREVIOUS RATING GAINS
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | CALCULATE BASE RATING CHANGE
    |--------------------------------------------------------------------------
    */

    let { changeA, changeB } = calculateRatingChange(
      whiteRating,
      blackRating,
      scoreWhite,
      scoreBlack
    );

    /*
    |--------------------------------------------------------------------------
    | CALCULATE STREAKS
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | COUNT CURRENT RESULT IN STREAK
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | STREAK MULTIPLIERS
    |--------------------------------------------------------------------------
    */

    const winMultWhite =
      getWinMultiplier(winStreakWhite);

    const lossMultWhite =
      getLossMultiplier(lossStreakWhite);

    const winMultBlack =
      getWinMultiplier(winStreakBlack);

    const lossMultBlack =
      getLossMultiplier(lossStreakBlack);

    /*
    |--------------------------------------------------------------------------
    | APPLY MULTIPLIERS
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | DETERMINE RATING FIELD
    |--------------------------------------------------------------------------
    */

    const ratingField = {
      RAPID: "rapidRating",
      BLITZ: "blitzRating",
      BULLET: "bulletRating",
    }[mode];

    const gainField = getGainField(mode);

    const now = new Date();

    /*
    |--------------------------------------------------------------------------
    | DATABASE TRANSACTION
    |--------------------------------------------------------------------------
    */

    const transactionResult =
      await prisma.$transaction(async (tx) => {

        /*
        |--------------------------------------------------------------------------
        | UPDATE WHITE PLAYER
        |--------------------------------------------------------------------------
        */

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

        /*
        |--------------------------------------------------------------------------
        | UPDATE BLACK PLAYER
        |--------------------------------------------------------------------------
        */

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

        /*
        |--------------------------------------------------------------------------
        | CREATE GAME RESULT
        |--------------------------------------------------------------------------
        */

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

        /*
        |--------------------------------------------------------------------------
        | CREATE WHITE RATING HISTORY
        |--------------------------------------------------------------------------
        */

        await tx.ratingGain.create({
          data: {
            playerId: pairing.whitePlayerId,

            pairingId: pairing.id,

            mode,

            amount: changeA,

            reason: `Round ${round} result`,
          },
        });

        /*
        |--------------------------------------------------------------------------
        | CREATE BLACK RATING HISTORY
        |--------------------------------------------------------------------------
        */

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

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

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


module.exports = router
