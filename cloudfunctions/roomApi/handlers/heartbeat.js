const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function heartbeat(payload, context, deps) {
  const now = deps.now();
  const committed = await deps.repository.runRoomTransaction(payload.roomId, async (tx) => {
    const room = await tx.getRoom();
    if (!room) throw new AppError('ROOM_NOT_FOUND');
    if (!room.players.some((player) => player.openid === context.openid)) {
      throw new AppError('PLAYER_NOT_FOUND');
    }

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

    await tx.updateRoom(toRoomPatch(nextRoom));
    return nextRoom;
  });

  await syncRoomViews(deps.repository, committed, now);
  return { online: true, openid: context.openid };
};
