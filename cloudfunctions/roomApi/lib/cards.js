const crypto = require('node:crypto');

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'C', 'D'];

function secureRandom() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function createDeck() {
  const cards = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${suit}-${rank}`, rank, suit });
    }
  }

  cards.push({ id: 'JOKER-SMALL', rank: 'SMALL', suit: 'JOKER' });
  cards.push({ id: 'JOKER-BIG', rank: 'BIG', suit: 'JOKER' });
  return cards;
}

function shuffle(cards, random = secureRandom) {
  const result = cards.slice();

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function drawRound(deck, playerCount, random = secureRandom) {
  const needed = playerCount * 4;
  const reshuffled = deck.length < needed;
  const sourceDeck = reshuffled ? shuffle(createDeck(), random) : deck.slice();
  const drawn = sourceDeck.slice(0, needed);
  const hands = [];

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    hands.push(drawn.slice(playerIndex * 4, playerIndex * 4 + 4));
  }

  return {
    hands,
    remainingDeck: sourceDeck.slice(needed),
    reshuffled
  };
}

module.exports = {
  createDeck,
  shuffle,
  drawRound
};
