const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDeck,
  shuffle,
  drawRound
} = require('../cloudfunctions/roomApi/lib/cards');

test('createDeck returns exactly 54 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 54);
  assert.equal(new Set(deck.map((card) => card.id)).size, 54);
  assert.equal(deck.filter((card) => card.suit === 'JOKER').length, 2);
});

test('shuffle does not mutate the source deck', () => {
  const deck = createDeck();
  const original = deck.map((card) => card.id);
  const shuffled = shuffle(deck, () => 0);
  assert.deepEqual(deck.map((card) => card.id), original);
  assert.notDeepEqual(shuffled.map((card) => card.id), original);
});

test('drawRound continues from the remaining deck when enough cards exist', () => {
  const deck = createDeck();
  const first = drawRound(deck, 4, () => 0.5);
  assert.equal(first.hands.length, 4);
  assert.equal(first.hands.every((hand) => hand.length === 4), true);
  assert.equal(first.remainingDeck.length, 38);
  assert.equal(first.reshuffled, false);

  const second = drawRound(first.remainingDeck, 4, () => 0.5);
  assert.equal(second.remainingDeck.length, 22);
  assert.equal(second.reshuffled, false);

  const third = drawRound(second.remainingDeck, 4, () => 0.5);
  assert.equal(third.remainingDeck.length, 6);
  assert.equal(third.reshuffled, false);

  const fourth = drawRound(third.remainingDeck, 4, () => 0.5);
  assert.equal(fourth.remainingDeck.length, 38);
  assert.equal(fourth.reshuffled, true);
});

test('drawRound reshuffles 54 cards when the remaining deck is insufficient', () => {
  const shortDeck = createDeck().slice(0, 6);
  const result = drawRound(shortDeck, 4, () => 0.5);
  assert.equal(result.hands.length, 4);
  assert.equal(result.hands.flat().length, 16);
  assert.equal(result.remainingDeck.length, 38);
  assert.equal(result.reshuffled, true);
  assert.equal(new Set(result.hands.flat().map((card) => card.id)).size, 16);
});

test('13 players leave two cards and force a reshuffle on the next round', () => {
  const first = drawRound(createDeck(), 13, () => 0.5);
  assert.equal(first.remainingDeck.length, 2);
  assert.equal(first.reshuffled, false);

  const second = drawRound(first.remainingDeck, 13, () => 0.5);
  assert.equal(second.remainingDeck.length, 2);
  assert.equal(second.reshuffled, true);
  assert.equal(second.hands.flat().length, 52);
});
