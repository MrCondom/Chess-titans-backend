function calculateAccuracy(points, totalRounds, rating) {
  if (!totalRounds || totalRounds === 0) return 0;

  const totalGames = totalRounds * 2;

  const winRate = Math.min(1, points / totalGames);
  const ratingFactor = rating / 2000;

  return Number(
    (winRate * ratingFactor * 100).toFixed(1)
  );
}

module.exports = { calculateAccuracy };