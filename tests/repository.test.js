const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('memory repository stores rooms, views, and hands', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({
    _id: 'room-1',
    roomCode: '123456',
    deckRemaining: [],
    players: []
  });
  await repository.saveRoomView({
    _id: 'room-1_owner',
    roomId: 'room-1',
    openid: 'owner'
  });
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    roundNumber: 1,
    openid: 'owner',
    slots: []
  });

  assert.equal((await repository.getRoomByCode('123456'))._id, 'room-1');
  assert.equal((await repository.listRoomViews('room-1')).length, 1);
  assert.equal(
    (await repository.getHand('room-1', 1, 'owner')).openid,
    'owner'
  );
});

test('room transaction commits all writes when the mutator resolves', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({
    _id: 'room-1',
    roomCode: '123456',
    deckRemaining: [],
    players: []
  });

  await repository.runRoomTransaction('room-1', async (tx) => {
    const room = await tx.getRoom();
    await tx.updateRoom({ ...room, status: 'playing' });
    await tx.saveHand({
      _id: 'room-1_1_owner',
      roomId: 'room-1',
      roundNumber: 1,
      openid: 'owner',
      slots: []
    });
  });

  assert.equal((await repository.getRoom('room-1')).status, 'playing');
  assert.equal(
    (await repository.getHand('room-1', 1, 'owner')).openid,
    'owner'
  );
});

test('room transaction rolls back all writes when the mutator throws', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({
    _id: 'room-1',
    roomCode: '123456',
    deckRemaining: [],
    players: []
  });

  await assert.rejects(
    repository.runRoomTransaction('room-1', async (tx) => {
      await tx.updateRoom({ status: 'playing' });
      await tx.saveHand({
        _id: 'room-1_1_owner',
        roomId: 'room-1',
        roundNumber: 1,
        openid: 'owner',
        slots: []
      });
      throw new Error('boom');
    }),
    /boom/
  );

  assert.equal((await repository.getRoom('room-1')).status, undefined);
  assert.equal(await repository.getHand('room-1', 1, 'owner'), null);
});
