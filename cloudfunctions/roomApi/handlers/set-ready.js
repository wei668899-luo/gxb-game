const { setPlayerReady } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function setReady(payload, context, deps) {
  const now = deps.now();
  const committed = await deps.repository.runRoomTransaction(payload.roomId, async (tx) => {
    const room = await tx.getRoom();
    if (!room) throw new AppError('ROOM_NOT_FOUND');
    if (!room.players.some((player) => player.openid === context.openid)) {
      throw new AppError('PLAYER_NOT_FOUND');
    }

    const nextRoom = setPlayerReady(room, context.openid, Boolean(payload.ready));
    await tx.updateRoom(toRoomPatch({
      ...nextRoom,
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000
    }));
    return nextRoom;
  });

  await syncRoomViews(deps.repository, committed, now);
  return { ready: Boolean(payload.ready) };
};
