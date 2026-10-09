const { addPlayer, createRoomView } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function joinRoom(payload, context, deps) {
  const room = await deps.repository.getRoomByCode(String(payload.roomCode || ''));
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  const committed = await deps.repository.runRoomTransaction(room._id, async (tx) => {
    const latest = await tx.getRoom();
    if (!latest) throw new AppError('ROOM_NOT_FOUND');

    const nextRoom = addPlayer(latest, {
      openid: context.openid,
      nickname: payload.nickname || defaultNickname(context.openid),
      avatarUrl: payload.avatarUrl || ''
    }, now);

    await tx.updateRoom(toRoomPatch(nextRoom));
    await tx.saveRoomView(createRoomView(nextRoom, context.openid, now));
    return nextRoom;
  });

  await syncRoomViews(deps.repository, committed, now);
  return { roomId: room._id, roomCode: room.roomCode };
};
