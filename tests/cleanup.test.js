const test = require('node:test');
const assert = require('node:assert/strict');
const { runCleanup } = require('../cloudfunctions/cleanupExpiredRooms/cleanup');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('cleanup removes only expired rooms and their related documents', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({ _id: 'expired', roomCode: '111111', expiresAt: 100 });
  await repository.createRoom({ _id: 'active', roomCode: '222222', expiresAt: 300 });
  await repository.saveRoomView({ _id: 'expired_owner', roomId: 'expired', openid: 'owner' });
  await repository.saveHand({
    _id: 'expired_1_owner',
    roomId: 'expired',
    roundNumber: 1,
    openid: 'owner'
  });

  const result = await runCleanup(repository, 200);
  assert.deepEqual(result.deletedRoomIds, ['expired']);
  assert.equal(await repository.getRoom('expired'), null);
  assert.equal((await repository.getRoom('active'))._id, 'active');
  assert.equal((await repository.listRoomViews('expired')).length, 0);
});
