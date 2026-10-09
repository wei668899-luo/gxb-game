const { randomInt } = require('node:crypto');
const { createRoomState } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { syncRoomViews } = require('../lib/room-view');

function defaultRoomCode(deps) {
  return String((deps.randomInt || randomInt)(100000, 1000000));
}

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function createRoom(payload, context, deps) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roomCode = defaultRoomCode(deps);
    if (await deps.repository.getRoomByCode(roomCode)) {
      continue;
    }

    const now = deps.now();
    const room = createRoomState({
      roomId: (deps.randomUUID || require('node:crypto').randomUUID)(),
      roomCode,
      owner: {
        openid: context.openid,
        nickname: payload.nickname || defaultNickname(context.openid),
        avatarUrl: payload.avatarUrl || ''
      },
      now
    });

    await deps.repository.createRoom(room);
    await syncRoomViews(deps.repository, room, now);
    return { roomId: room._id, roomCode: room.roomCode };
  }

  throw new AppError('ROOM_CODE_EXHAUSTED', '房间号生成失败，请重试');
};
