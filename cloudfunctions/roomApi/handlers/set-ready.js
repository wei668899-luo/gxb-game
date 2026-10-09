const { setPlayerReady } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function setReady(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  const nextRoom = setPlayerReady(room, context.openid, Boolean(payload.ready));
  await deps.repository.updateRoom(room._id, toRoomPatch({
    ...nextRoom,
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  }));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { ready: Boolean(payload.ready) };
};
