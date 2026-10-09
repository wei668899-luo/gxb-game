const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, toPublicError } = require('../cloudfunctions/roomApi/lib/errors');
const {
  toRoomPatch,
  syncRoomViews
} = require('../cloudfunctions/roomApi/lib/room-view');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('toPublicError hides internal messages while preserving app error codes', () => {
  const publicError = toPublicError(new AppError('ROOM_FULL', '房间已满'));
  assert.deepEqual(publicError, {
    ok: false,
    error: { code: 'ROOM_FULL', message: '房间已满' }
  });

  assert.deepEqual(toPublicError(new Error('secret stack')), {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '操作失败，请重试' }
  });
});

test('toRoomPatch removes immutable _id', () => {
  assert.deepEqual(toRoomPatch({ _id: 'room-1', status: 'playing' }), {
    status: 'playing'
  });
});

test('syncRoomViews writes one view for every current player', async () => {
  const repository = createMemoryRepository();
  const room = {
    _id: 'room-1',
    roomCode: '123456',
    ownerOpenid: 'a',
    status: 'waiting',
    players: [
      { openid: 'a', nickname: 'A', avatarUrl: '', joinedRound: 1, ready: false, lastSeenAt: 1000 },
      { openid: 'b', nickname: 'B', avatarUrl: '', joinedRound: 1, ready: false, lastSeenAt: 1000 }
    ],
    roundNumber: 0,
    deckRemaining: [],
    readyOpenids: []
  };

  await syncRoomViews(repository, room, 1000);
  const views = await repository.listRoomViews('room-1');
  assert.deepEqual(views.map((view) => view.openid).sort(), ['a', 'b']);
  assert.equal(views[0].players.length, 2);
});
