function getResultPoints(scoreA, scoreB) {
  if (scoreA > scoreB) {
    return {
      pointsA: 1,
      pointsB: 0,
    };
  }

  if (scoreB > scoreA) {
    return {
      pointsA: 0,
      pointsB: 1,
    };
  }

  return {
    pointsA: 0.5,
    pointsB: 0.5,
  };
}


function calculateAccuracy(points, rounds) {
  if (!rounds || rounds <= 0) {
    return 0;
  }

  return Number(
    ((points / rounds) * 100).toFixed(2)
  );
}


module.exports = {
  getResultPoints,
  calculateAccuracy,
};

