const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const dealRound = require('../cloudfunctions/roomApi/handlers/deal-round');

async function setup(playerCount = 4) {
  const repository = createMemoryRepository();
  let tick = 0;
  const deps = {
    repository,
    now: () => 1000 + tick++,
    randomUUID: () => 'room-1',
    randomInt: () => 345678,
    random: () => 0.25
  };
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'p-1' },
    deps
  );
  for (let index = 2; index <= playerCount; index += 1) {
    await joinRoom(
      { roomCode: room.roomCode, nickname: `玩家${index}`, avatarUrl: '' },
      { openid: `p-${index}` },
      deps
    );
  }
  return { repository, deps, room };
}

test('first deal gives every player four unique cards and uses the deck', async () => {
  const { repository, deps, room } = await setup(4);
  const result = await dealRound(
    { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' },
    { openid: 'p-1' },
    deps
  );

  assert.equal(result.roundNumber, 1);
  assert.equal(result.remainingDeckCount, 38);
  assert.equal(result.reshuffled, false);
  assert.equal((await repository.getHand(room.roomId, 1, 'p-1')).slots.length, 4);
  assert.equal((await repository.getHand(room.roomId, 1, 'p-4')).slots.length, 4);
});

test('the same deal request is idempotent', async () => {
  const { deps, room } = await setup(4);
  const payload = { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' };
  const first = await dealRound(payload, { openid: 'p-1' }, deps);
  const second = await dealRound(payload, { openid: 'p-1' }, deps);
  assert.equal(second.roundNumber, first.roundNumber);
  assert.equal(second.idempotent, true);
});

test('insufficient deck is reshuffled to 54 before dealing', async () => {
  const { repository, deps, room } = await setup(4);
  const stored = await repository.getRoom(room.roomId);
  await repository.updateRoom(room.roomId, {
    deckRemaining: stored.deckRemaining.slice(0, 6)
  });

  const result = await dealRound(
    { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' },
    { openid: 'p-1' },
    deps
  );
  assert.equal(result.reshuffled, true);
  assert.equal(result.remainingDeckCount, 38);
});
