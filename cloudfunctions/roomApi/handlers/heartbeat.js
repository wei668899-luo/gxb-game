const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function heartbeat(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  if (!room.players.some((player) => player.openid === context.openid)) {
    throw new AppError('PLAYER_NOT_FOUND');
  }

  const now = deps.now();
  const nextRoom = {
    ...room,
    players: room.players.map((player) => (
      player.openid === context.openid
        ? { ...player, lastSeenAt: now }
        : player
    )),
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  };

  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { online: true, openid: context.openid };
};
