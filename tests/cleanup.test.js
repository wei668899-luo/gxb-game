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
  await repository.saveHand({
    _id: 'active_1_owner',
    roomId: 'active',
    roundNumber: 1,
    openid: 'owner'
  });

  const result = await runCleanup(repository, 200);
  assert.deepEqual(result.deletedRoomIds, ['expired']);
  assert.equal(await repository.getRoom('expired'), null);
  assert.equal((await repository.getRoom('active'))._id, 'active');
  assert.equal((await repository.listRoomViews('expired')).length, 0);
  assert.equal(await repository.getHand('expired', 1, 'owner'), null);
  assert.equal((await repository.getHand('active', 1, 'owner')).roundNumber, 1);
});

test('cleanup rechecks expiry and preserves a room refreshed after listing', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({ _id: 'expired-listed', roomCode: '111111', expiresAt: 100 });
  await repository.saveRoomView({
    _id: 'expired-listed_owner',
    roomId: 'expired-listed',
    openid: 'owner'
  });
  await repository.saveHand({
    _id: 'expired-listed_1_owner',
    roomId: 'expired-listed',
    roundNumber: 1,
    openid: 'owner'
  });

  const staleRoom = await repository.getRoom('expired-listed');
  await repository.updateRoom('expired-listed', { expiresAt: 500 });
  const staleListingRepository = {
    ...repository,
    async listExpiredRooms() {
      return [staleRoom];
    }
  };

  const result = await runCleanup(staleListingRepository, 200);
  assert.deepEqual(result.deletedRoomIds, []);
  assert.equal((await repository.getRoom('expired-listed'))._id, 'expired-listed');
  assert.equal((await repository.listRoomViews('expired-listed')).length, 1);
  assert.equal((await repository.getHand('expired-listed', 1, 'owner')).roomId, 'expired-listed');
});
