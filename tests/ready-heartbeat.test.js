const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const setReady = require('../cloudfunctions/roomApi/handlers/set-ready');
const heartbeat = require('../cloudfunctions/roomApi/handlers/heartbeat');

async function setup() {
  const repository = createMemoryRepository();
  let tick = 0;
  const deps = {
    repository,
    now: () => 1000 + tick++,
    randomUUID: () => 'room-1',
    randomInt: () => 234567,
    random: () => 0.5
  };
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    deps
  );
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    deps
  );
  return { repository, deps, room };
}

test('setReady updates the room and every view', async () => {
  const { repository, deps, room } = await setup();
  const result = await setReady(
    { roomId: room.roomId, ready: true },
    { openid: 'owner' },
    deps
  );
  assert.equal(result.ready, true);

  const views = await repository.listRoomViews(room.roomId);
  const ownerView = views.find((view) => view.openid === 'owner');
  const otherView = views.find((view) => view.openid === 'p-2');
  assert.equal(ownerView.players.find((player) => player.openid === 'owner').ready, true);
  assert.equal(otherView.players.find((player) => player.openid === 'owner').ready, true);
  assert.equal(otherView.players.find((player) => player.openid === 'p-2').ready, false);
});

test('heartbeat updates lastSeenAt and keeps the room alive', async () => {
  const { repository, deps, room } = await setup();
  const before = await repository.getRoom(room.roomId);
  const result = await heartbeat({ roomId: room.roomId }, { openid: 'owner' }, deps);
  const after = await repository.getRoom(room.roomId);

  assert.equal(result.openid, 'owner');
  assert.equal(after.players.find((player) => player.openid === 'owner').lastSeenAt > 1000, true);
  assert.equal(after.expiresAt > before.expiresAt, true);

  const views = await repository.listRoomViews(room.roomId);
  assert.equal(views.length, 2);
  assert.equal(views.every((view) => (
    view.players.find((player) => player.openid === 'owner').online
  )), true);
});

test('setReady keeps every player ready across sequential toggles', async () => {
  const { repository, deps, room } = await setup();
  await setReady({ roomId: room.roomId, ready: true }, { openid: 'owner' }, deps);
  await setReady({ roomId: room.roomId, ready: true }, { openid: 'p-2' }, deps);

  const stored = await repository.getRoom(room.roomId);
  assert.equal(stored.players.find((player) => player.openid === 'owner').ready, true);
  assert.equal(stored.players.find((player) => player.openid === 'p-2').ready, true);

  const views = await repository.listRoomViews(room.roomId);
  const ownerView = views.find((view) => view.openid === 'owner');
  const otherView = views.find((view) => view.openid === 'p-2');
  assert.equal(ownerView.players.find((player) => player.openid === 'owner').ready, true);
  assert.equal(otherView.players.find((player) => player.openid === 'p-2').ready, true);
});

test('heartbeat refreshes lastSeenAt for each player without clobbering', async () => {
  const { repository, deps, room } = await setup();
  await heartbeat({ roomId: room.roomId }, { openid: 'owner' }, deps);
  await heartbeat({ roomId: room.roomId }, { openid: 'p-2' }, deps);

  const stored = await repository.getRoom(room.roomId);
  const owner = stored.players.find((player) => player.openid === 'owner');
  const other = stored.players.find((player) => player.openid === 'p-2');
  assert.equal(owner.lastSeenAt > 1000, true);
  assert.equal(other.lastSeenAt > 1000, true);
  assert.equal(owner.lastSeenAt !== other.lastSeenAt, true);
});
