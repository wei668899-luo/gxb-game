const { removePlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViewsWith } = require('../lib/room-view');

module.exports = async function leaveRoom(payload, context, deps) {
  const now = deps.now();
  await deps.repository.runRoomTransaction(payload.roomId, async (tx) => {
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
    await syncRoomViewsWith(tx, nextRoom, now);
  });

  return { roomId: payload.roomId, left: true };
};
