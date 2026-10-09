const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const arrangeHand = require('../cloudfunctions/roomApi/handlers/arrange-hand');

test('arrangeHand saves a permutation of the existing four cards', async () => {
  const repository = createMemoryRepository();
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    openid: 'owner',
    roundNumber: 1,
    cards: [
      { id: 'S-A' },
      { id: 'H-K' },
      { id: 'D-3' },
      { id: 'JOKER-BIG' }
    ],
    slots: ['S-A', 'H-K', 'D-3', 'JOKER-BIG']
  });

  const result = await arrangeHand({
    roomId: 'room-1',
    roundNumber: 1,
    slots: ['JOKER-BIG', 'D-3', 'H-K', 'S-A']
  }, { openid: 'owner' }, {
    repository,
    now: () => 2000
  });

  assert.deepEqual(result.slots, ['JOKER-BIG', 'D-3', 'H-K', 'S-A']);
});

test('arrangeHand rejects duplicated or substituted cards', async () => {
  const repository = createMemoryRepository();
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    openid: 'owner',
    roundNumber: 1,
    cards: [{ id: 'S-A' }, { id: 'H-K' }, { id: 'D-3' }, { id: 'JOKER-BIG' }],
    slots: ['S-A', 'H-K', 'D-3', 'JOKER-BIG']
  });

  await assert.rejects(
    arrangeHand({
      roomId: 'room-1',
      roundNumber: 1,
      slots: ['S-A', 'S-A', 'D-3', 'JOKER-BIG']
    }, { openid: 'owner' }, { repository, now: () => 2000 }),
    /INVALID_HAND_LAYOUT/
  );
});
