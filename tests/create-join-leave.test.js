const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const leaveRoom = require('../cloudfunctions/roomApi/handlers/leave-room');

function deps(repository) {
  let nextId = 0;
  return {
    repository,
    now: () => 1000 + nextId,
    randomUUID: () => `room-${++nextId}`,
    randomInt: () => 123456,
    random: () => 0.5
  };
}

test('createRoom creates the owner view and returns a six-digit code', async () => {
  const repository = createMemoryRepository();
  const result = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    deps(repository)
  );

  assert.equal(result.roomCode, '123456');
  assert.equal((await repository.listRoomViews(result.roomId)).length, 1);
});

test('joinRoom rejects duplicate players and the fourteenth player', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );

  for (let index = 2; index <= 13; index += 1) {
    await joinRoom(
      { roomCode: room.roomCode, nickname: `玩家${index}`, avatarUrl: '' },
      { openid: `p-${index}` },
      dependency
    );
  }

  await assert.rejects(
    joinRoom(
      { roomCode: room.roomCode, nickname: '玩家14', avatarUrl: '' },
      { openid: 'p-14' },
      dependency
    ),
    /ROOM_FULL/
  );
  await assert.rejects(
    joinRoom(
      { roomCode: room.roomCode, nickname: '房主', avatarUrl: '' },
      { openid: 'owner' },
      dependency
    ),
    /ALREADY_JOINED/
  );
});

test('leaveRoom removes the player view and transfers ownership', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    dependency
  );

  await leaveRoom({ roomId: room.roomId }, { openid: 'owner' }, dependency);
  const stored = await repository.getRoom(room.roomId);
  assert.equal(stored.ownerOpenid, 'p-2');
  assert.deepEqual(
    (await repository.listRoomViews(room.roomId)).map((view) => view.openid),
    ['p-2']
  );
});

test('joinRoom applies the join against the latest committed room', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );

  // Snapshot the authoritative room before a concurrent join commits.
  const stale = await repository.getRoomByCode(room.roomCode);
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    dependency
  );

  // Force the second join's initial room-code lookup to return the stale snapshot.
  const staleRepository = {
    ...repository,
    async getRoomByCode() { return stale; }
  };
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家3', avatarUrl: '' },
    { openid: 'p-3' },
    { ...dependency, repository: staleRepository }
  );

  const stored = await repository.getRoom(room.roomId);
  assert.deepEqual(stored.players.map((player) => player.openid), ['owner', 'p-2', 'p-3']);
  assert.deepEqual(
    (await repository.listRoomViews(room.roomId)).map((view) => view.openid).sort(),
    ['owner', 'p-2', 'p-3']
  );
});

test('leaveRoom transfers ownership from the latest committed room without a stale view', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );

  // Snapshot the authoritative room before a concurrent join commits.
  const stale = await repository.getRoom(room.roomId);
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    dependency
  );

  // Force the leave handler's outside read to return the stale (owner-only) snapshot.
  const staleRepository = {
    ...repository,
    async getRoom() { return stale; }
  };
  await leaveRoom(
    { roomId: room.roomId },
    { openid: 'owner' },
    { ...dependency, repository: staleRepository }
  );

  const stored = await repository.getRoom(room.roomId);
  assert.equal(stored.ownerOpenid, 'p-2');
  assert.deepEqual(stored.players.map((player) => player.openid), ['p-2']);
  assert.deepEqual(
    (await repository.listRoomViews(room.roomId)).map((view) => view.openid),
    ['p-2']
  );
});
