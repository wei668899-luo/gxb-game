const { removePlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function leaveRoom(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  if (!room.players.some((player) => player.openid === context.openid)) {
    throw new AppError('PLAYER_NOT_FOUND');
  }

  const now = deps.now();
  const nextRoom = {
    ...removePlayer(room, context.openid),
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  };
  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await deps.repository.removeRoomView(room._id, context.openid);
  await syncRoomViews(deps.repository, nextRoom, now);
  return { roomId: room._id, left: true };
};
