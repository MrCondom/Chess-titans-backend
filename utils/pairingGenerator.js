function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate pairings for players.
 *
 * @param {Array} players
 * @param {number} rounds
 * @returns {Array}
 */
function generatePairings(players, rounds = 5) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("At least two players are required.");
  }

  const pairings = [];

  const shuffledPlayers = shuffle(players);

  for (let round = 1; round <= rounds; round++) {
    const roundPairings = [];

    const roundPlayers = shuffle(shuffledPlayers);

    for (let i = 0; i < roundPlayers.length - 1; i += 2) {
      const playerA = roundPlayers[i];
      const playerB = roundPlayers[i + 1];

      // Randomly determine white/black
      const whiteFirst = Math.random() < 0.5;

      const white = whiteFirst ? playerA : playerB;
      const black = whiteFirst ? playerB : playerA;

      roundPairings.push({
        round,
        whitePlayerId: white.id,
        blackPlayerId: black.id,
      });
    }

    pairings.push(...roundPairings);
  }

  return pairings;
}

module.exports = {
  generatePairings,
};
