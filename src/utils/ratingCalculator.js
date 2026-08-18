const rules = require("./ratingRules");

function calculateRatingChange(
  ratingA,
  ratingB,
  scoreA,
  scoreB
) {
  const diff = Math.abs(ratingA - ratingB);

  let changeA = 0;
  let changeB = 0;

  // No game played
  if (scoreA === 0 && scoreB === 0) {
    return {
      changeA: 0,
      changeB: 0,
    };
  }

  const rule = rules.baseRules.find(
    (r) =>
      diff >= r.range[0] &&
      diff <= r.range[1]
  );

  if (!rule) {
    return {
      changeA: 0,
      changeB: 0,
    };
  }

  // A wins
  if (scoreA > scoreB) {
    changeA = rule.win;
    changeB = rule.loss;

    // Stronger player wins
    if (ratingA > ratingB) {
      changeA =
        rules.adjustment.strongerWin.strong;

      changeB =
        rules.adjustment.strongerWin.weak;
    }

    // Weaker player wins
    else if (ratingB > ratingA) {
      changeB =
        rules.adjustment.strongerLoss.strong;

      changeA =
        rules.adjustment.strongerLoss.weak;
    }
  }

  // B wins
  else if (scoreB > scoreA) {
    changeB = rule.win;
    changeA = rule.loss;

    // Stronger player wins
    if (ratingB > ratingA) {
      changeB =
        rules.adjustment.strongerWin.strong;

      changeA =
        rules.adjustment.strongerWin.weak;
    }

    // Weaker player wins
    else if (ratingA > ratingB) {
      changeA =
        rules.adjustment.strongerLoss.strong;

      changeB =
        rules.adjustment.strongerLoss.weak;
    }
  }

  // Draw
  else {
    // Equal ratings
    if (ratingA === ratingB) {
      return {
        changeA: 0,
        changeB: 0,
      };
    }

    // A is stronger
    if (ratingA > ratingB) {
      changeA =
        rules.adjustment.strongerDraw.strong;

      changeB =
        rules.adjustment.strongerDraw.weak;
    }

    // B is stronger
    else {
      changeB =
        rules.adjustment.strongerDraw.strong;

      changeA =
        rules.adjustment.strongerDraw.weak;
    }
  }

  return {
    changeA,
    changeB,
  };
}

module.exports = {
  calculateRatingChange,
};