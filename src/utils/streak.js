function getPlayerSide(result, playerId) {
  if (result.whitePlayerId === playerId) {
    return "WHITE";
  }

  if (result.blackPlayerId === playerId) {
    return "BLACK";
  }

  return null;
}


/**
 * Get consecutive wins.
 *
 * Only APPROVED results count.
 */
function getWinStreak(
  results,
  playerId,
  mode,
  category
) {
  let streak = 0;

  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];

    if (
      result.approvalStatus !== "APPROVED"
    ) {
      continue;
    }

    if (result.mode !== mode) {
      continue;
    }

    if (result.category !== category) {
      continue;
    }

    const side = getPlayerSide(
      result,
      playerId
    );

    if (!side) {
      continue;
    }

    const playerScore =
      side === "WHITE"
        ? result.whiteScore
        : result.blackScore;

    const opponentScore =
      side === "WHITE"
        ? result.blackScore
        : result.whiteScore;

    if (playerScore > opponentScore) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}


/**
 * Get consecutive losses.
 *
 * Only APPROVED results count.
 */
function getLossStreak(
  results,
  playerId,
  mode,
  category
) {
  let streak = 0;

  for (let i = results.length - 1; i >= 0; i--) {
    const result = results[i];

    if (
      result.approvalStatus !== "APPROVED"
    ) {
      continue;
    }

    if (result.mode !== mode) {
      continue;
    }

    if (result.category !== category) {
      continue;
    }

    const side = getPlayerSide(
      result,
      playerId
    );

    if (!side) {
      continue;
    }

    const playerScore =
      side === "WHITE"
        ? result.whiteScore
        : result.blackScore;

    const opponentScore =
      side === "WHITE"
        ? result.blackScore
        : result.whiteScore;

    if (playerScore < opponentScore) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}


/**
 * Win streak multiplier.
 */
function getWinMultiplier(winStreak) {
  if (winStreak >= 6) {
    return 5;
  }

  if (winStreak >= 3) {
    return 3;
  }

  return 1;
}


/**
 * Loss streak multiplier.
 *
 * This applies only to gains.
 */
function getLossMultiplier(lossStreak) {
  if (lossStreak >= 6) {
    return 3;
  }

  if (lossStreak >= 3) {
    return 2;
  }

  return 1;
}


module.exports = {
  getWinStreak,
  getLossStreak,
  getWinMultiplier,
  getLossMultiplier,
};
