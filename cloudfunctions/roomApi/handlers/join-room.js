const { addPlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function joinRoom(payload, context, deps) {
  const room = await deps.repository.getRoomByCode(String(payload.roomCode || ''));
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  const nextRoom = addPlayer(room, {
    openid: context.openid,
    nickname: payload.nickname || defaultNickname(context.openid),
    avatarUrl: payload.avatarUrl || ''
  }, now);

  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { roomId: room._id, roomCode: room.roomCode };
};
