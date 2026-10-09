const { removePlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function leaveRoom(payload, context, deps) {
  const now = deps.now();
  const committed = await deps.repository.runRoomTransaction(payload.roomId, async (tx) => {
    const latest = await tx.getRoom();
    if (!latest) throw new AppError('ROOM_NOT_FOUND');
    if (!latest.players.some((player) => player.openid === context.openid)) {
      throw new AppError('PLAYER_NOT_FOUND');
    }

    const nextRoom = {
      ...removePlayer(latest, context.openid),
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000
    };

    await tx.updateRoom(toRoomPatch(nextRoom));
    await tx.removeRoomView(payload.roomId, context.openid);
    return nextRoom;
  });

  await syncRoomViews(deps.repository, committed, now);
  return { roomId: payload.roomId, left: true };
};
