const express = require("express");
const prisma = require("../lib/prisma");

const router = express.Router();

const VALID_MODES = ["RAPID", "BLITZ", "BULLET"];


function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMode(mode) {
  const value = String(mode || "rapid").trim().toUpperCase();

  if (!VALID_MODES.includes(value)) {
    return null;
  }

  return value;
}

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

function calculatePlayerStats(results, playerId) {
  let totalPoints = 0;
  let totalRounds = 0;

  let wins = 0;
  let draws = 0;
  let losses = 0;

  for (const game of results) {
    let score = null;

    if (game.whitePlayerId === playerId) {
      score = game.whiteScore;
    } else if (game.blackPlayerId === playerId) {
      score = game.blackScore;
    }

    if (score === null) {
      continue;
    }

    totalPoints += Number(score);
    totalRounds++;

    if (score === 1) {
      wins++;
    } else if (score === 0.5) {
      draws++;
    } else if (score === 0) {
      losses++;
    }
  }

  const accuracy =
    totalRounds > 0
      ? Number(((totalPoints / totalRounds) * 100).toFixed(2))
      : 0;

  return {
    totalPoints,
    totalRounds,
    wins,
    draws,
    losses,
    accuracy,
  };
}


router.get("/players", async (req, res) => {
  try {
    const category = normalize(req.query.category);
    const mode = normalizeMode(req.query.mode || "rapid");

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }


    const players = await prisma.player.findMany({
      where: {
        category,
        status: "ACTIVE",
      },

      orderBy: {
        id: "asc",
      },
    });


    const results = await prisma.gameResult.findMany({
      where: {
        category,
        mode,
      },

      orderBy: {
        date: "asc",
      },
    });

    const rankings = players.map((player) => {
      const stats = calculatePlayerStats(
        results,
        player.id
      );

      return {
        playerId: player.id,
        fullName: player.fullName,
        username: player.username,
        category: player.category,
        mode: mode.toLowerCase(),

        rating: getPlayerRating(
          player,
          mode
        ),

        totalPoints: stats.totalPoints,
        totalRounds: stats.totalRounds,

        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,

        accuracy: stats.accuracy,
      };
    });


    rankings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }

      if (b.totalRounds !== a.totalRounds) {
        return b.totalRounds - a.totalRounds;
      }

      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      return a.playerId - b.playerId;
    });

    rankings.forEach((player, index) => {
      player.rank = index + 1;
    });

    return res.json({
      success: true,
      category,
      mode: mode.toLowerCase(),
      rankings,
    });
  } catch (error) {
    console.error(
      "get player rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load player rankings.",
    });
  }
});


router.get("/players/all", async (req, res) => {
  try {
    const mode = normalizeMode(
      req.query.mode || "rapid"
    );

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }

    const players = await prisma.player.findMany({
      where: {
        status: "ACTIVE",
      },

      orderBy: [
        {
          category: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    const results = await prisma.gameResult.findMany({
      where: {
        mode,
      },

      orderBy: {
        date: "asc",
      },
    });


    const categories = {};

    for (const player of players) {
      const category = player.category || "";

      if (!categories[category]) {
        categories[category] = [];
      }

      const stats = calculatePlayerStats(
        results.filter(
          (game) =>
            game.category === category
        ),
        player.id
      );

      categories[category].push({
        playerId: player.id,
        fullName: player.fullName,
        username: player.username,

        category,

        mode: mode.toLowerCase(),

        rating: getPlayerRating(
          player,
          mode
        ),

        totalPoints: stats.totalPoints,
        totalRounds: stats.totalRounds,

        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,

        accuracy: stats.accuracy,
      });
    }


    for (const category of Object.keys(categories)) {
      categories[category].sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }

        if (b.accuracy !== a.accuracy) {
          return b.accuracy - a.accuracy;
        }

        if (b.totalRounds !== a.totalRounds) {
          return b.totalRounds - a.totalRounds;
        }

        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }

        return a.playerId - b.playerId;
      });

      categories[category].forEach(
        (player, index) => {
          player.rank = index + 1;
        }
      );
    }

    return res.json({
      success: true,
      mode: mode.toLowerCase(),
      data: categories,
    });
  } catch (error) {
    console.error(
      "get all player rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load player rankings.",
    });
  }
});


router.post("/players/rebuild", async (req, res) => {
  try {
    const category = normalize(req.body.category);
    const mode = normalizeMode(
      req.body.mode || "rapid"
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }

    const players = await prisma.player.findMany({
      where: {
        category,
        status: "ACTIVE",
      },

      orderBy: {
        id: "asc",
      },
    });

    const results = await prisma.gameResult.findMany({
      where: {
        category,
        mode,
      },

      orderBy: {
        date: "asc",
      },
    });

    const rankings = players.map((player) => {
      const stats = calculatePlayerStats(
        results,
        player.id
      );

      return {
        playerId: player.id,
        totalPoints: stats.totalPoints,
        totalRounds: stats.totalRounds,
        accuracy: stats.accuracy,
      };
    });

    rankings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }

      if (b.totalRounds !== a.totalRounds) {
        return b.totalRounds - a.totalRounds;
      }

      return a.playerId - b.playerId;
    });

    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

   
    await prisma.$transaction(async (tx) => {

      await tx.playerRanking.deleteMany({
        where: {
          category,
          mode,
          month: null,
          year: null,
        },
      });

      for (const ranking of rankings) {
        await tx.playerRanking.create({
          data: {
            playerId: ranking.playerId,

            category,
            mode,

            rank: ranking.rank,

            totalPoints: ranking.totalPoints,

            totalRounds:
              ranking.totalRounds,

            accuracy:
              ranking.accuracy,

            month: null,
            year: null,
          },
        });
      }
    });

    return res.json({
      success: true,
      message:
        `Player rankings rebuilt successfully for ${category}.`,

      category,
      mode: mode.toLowerCase(),

      rankings,
    });
  } catch (error) {
    console.error(
      "rebuild player rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to rebuild player rankings.",
    });
  }
});


router.get("/players/stored", async (req, res) => {
  try {
    const category = normalize(req.query.category);
    const mode = normalizeMode(
      req.query.mode || "rapid"
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }

    const rankings =
      await prisma.playerRanking.findMany({
        where: {
          category,
          mode,
          month: null,
          year: null,
        },

        include: {
          player: {
            select: {
              id: true,
              fullName: true,
              username: true,
              category: true,
              rapidRating: true,
              blitzRating: true,
              bulletRating: true,
              status: true,
            },
          },
        },

        orderBy: {
          rank: "asc",
        },
      });

    return res.json({
      success: true,
      category,
      mode: mode.toLowerCase(),
      rankings,
    });
  } catch (error) {
    console.error(
      "get stored player rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load stored rankings.",
    });
  }
});



router.get("/teams", async (req, res) => {
  try {
    const category = normalize(req.query.category);
    const mode = normalizeMode(
      req.query.mode || "rapid"
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }


    const teams = await prisma.team.findMany({
      include: {
        players: {
          where: {
            status: "ACTIVE",
            category,
          },

          select: {
            id: true,
            fullName: true,
            username: true,
          },
        },
      },

      orderBy: {
        id: "asc",
      },
    });


    const results = await prisma.gameResult.findMany({
      where: {
        category,
        mode,
      },

      orderBy: {
        date: "asc",
      },
    });


    const rankings = [];

    for (const team of teams) {
      let totalPoints = 0;
      let totalRounds = 0;

      let wins = 0;
      let draws = 0;
      let losses = 0;

      let ratingGain = 0;

      const playerIds = new Set(
        team.players.map(
          (player) => player.id
        )
      );

      for (const game of results) {
        let score = null;
        let ratingChange = 0;

        if (
          playerIds.has(
            game.whitePlayerId
          )
        ) {
          score = game.whiteScore;
          ratingChange =
            game.whiteRatingChange;
        } else if (
          playerIds.has(
            game.blackPlayerId
          )
        ) {
          score = game.blackScore;
          ratingChange =
            game.blackRatingChange;
        }

        if (score === null) {
          continue;
        }

        totalPoints += Number(score);
        totalRounds++;

        ratingGain += Number(
          ratingChange || 0
        );

        if (score === 1) {
          wins++;
        } else if (score === 0.5) {
          draws++;
        } else if (score === 0) {
          losses++;
        }
      }

      const accuracy =
        totalRounds > 0
          ? Number(
              (
                (totalPoints /
                  totalRounds) *
                100
              ).toFixed(2)
            )
          : 0;

      rankings.push({
        teamId: team.id,
        teamName: team.name,

        category,

        mode: mode.toLowerCase(),

        totalPoints,
        totalRounds,

        wins,
        draws,
        losses,

        accuracy,
        ratingGain,

        playerCount:
          team.players.length,
      });
    }

    

    rankings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }

      if (b.ratingGain !== a.ratingGain) {
        return b.ratingGain - a.ratingGain;
      }

      if (b.totalRounds !== a.totalRounds) {
        return b.totalRounds - a.totalRounds;
      }

      return a.teamId - b.teamId;
    });

    rankings.forEach((team, index) => {
      team.rank = index + 1;
    });

    return res.json({
      success: true,

      category,

      mode: mode.toLowerCase(),

      rankings,
    });
  } catch (error) {
    console.error(
      "get team rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load team rankings.",
    });
  }
});



router.post("/teams/rebuild", async (req, res) => {
  try {
    const category = normalize(req.body.category);
    const mode = normalizeMode(
      req.body.mode || "rapid"
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }

    const teams = await prisma.team.findMany({
      include: {
        players: {
          where: {
            status: "ACTIVE",
            category,
          },

          select: {
            id: true,
          },
        },
      },

      orderBy: {
        id: "asc",
      },
    });

    const results = await prisma.gameResult.findMany({
      where: {
        category,
        mode,
      },

      orderBy: {
        date: "asc",
      },
    });

    const rankings = [];

    for (const team of teams) {
      let totalPoints = 0;
      let totalRounds = 0;
      let ratingGain = 0;

      const playerIds = new Set(
        team.players.map(
          (player) => player.id
        )
      );

      for (const game of results) {
        if (
          playerIds.has(
            game.whitePlayerId
          )
        ) {
          totalPoints += Number(
            game.whiteScore
          );

          totalRounds++;

          ratingGain += Number(
            game.whiteRatingChange || 0
          );
        } else if (
          playerIds.has(
            game.blackPlayerId
          )
        ) {
          totalPoints += Number(
            game.blackScore
          );

          totalRounds++;

          ratingGain += Number(
            game.blackRatingChange || 0
          );
        }
      }

      const accuracy =
        totalRounds > 0
          ? Number(
              (
                (totalPoints /
                  totalRounds) *
                100
              ).toFixed(2)
            )
          : 0;

      rankings.push({
        teamId: team.id,

        totalPoints,
        totalRounds,

        ratingGain,

        accuracy,
      });
    }

  

    rankings.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      if (b.accuracy !== a.accuracy) {
        return b.accuracy - a.accuracy;
      }

      if (b.ratingGain !== a.ratingGain) {
        return b.ratingGain - a.ratingGain;
      }

      if (b.totalRounds !== a.totalRounds) {
        return b.totalRounds - a.totalRounds;
      }

      return a.teamId - b.teamId;
    });

    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1;
    });

    

    await prisma.$transaction(async (tx) => {
      await tx.teamRanking.deleteMany({
        where: {
          category,
          mode,
          month: null,
          year: null,
        },
      });

      for (const ranking of rankings) {
        await tx.teamRanking.create({
          data: {
            teamId:
              ranking.teamId,

            category,
            mode,

            rank:
              ranking.rank,

            totalPoints: ranking.totalPoints,

            ratingGain:
              Math.round(
                ranking.ratingGain
              ),

            month: null,
            year: null,
          },
        });
      }
    });

    return res.json({
      success: true,

      message:
        `Team rankings rebuilt successfully for ${category}.`,

      category,

      mode: mode.toLowerCase(),

      rankings,
    });
  } catch (error) {
    console.error(
      "rebuild team rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to rebuild team rankings.",
    });
  }
});


router.get("/teams/stored", async (req, res) => {
  try {
    const category = normalize(req.query.category);
    const mode = normalizeMode(
      req.query.mode || "rapid"
    );

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required.",
      });
    }

    if (!mode) {
      return res.status(400).json({
        success: false,
        message: "Invalid game mode.",
      });
    }

    const rankings =
      await prisma.teamRanking.findMany({
        where: {
          category,
          mode,
          month: null,
          year: null,
        },

        include: {
          team: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },

        orderBy: {
          rank: "asc",
        },
      });

    return res.json({
      success: true,

      category,

      mode: mode.toLowerCase(),

      rankings,
    });
  } catch (error) {
    console.error(
      "get stored team rankings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load stored team rankings.",
    });
  }
});



module.exports = router;
