function shuffle(array) {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}


function generateRoundPairings(players) {
  if (!Array.isArray(players) || players.length < 2) {
    throw new Error("At least two players are required.");
  }

  const shuffled = shuffle(players);

  const pairings = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const playerA = shuffled[i];
    const playerB = shuffled[i + 1];

    const whiteFirst = Math.random() < 0.5;

    pairings.push({
      whitePlayerId: whiteFirst
        ? playerA.id
        : playerB.id,

      blackPlayerId: whiteFirst
        ? playerB.id
        : playerA.id,
    });
  }

  return pairings;
}


module.exports = {
  generateRoundPairings,
};
