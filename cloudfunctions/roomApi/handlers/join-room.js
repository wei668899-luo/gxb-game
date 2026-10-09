const { addPlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViewsWith } = require('../lib/room-view');

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function joinRoom(payload, context, deps) {
  const room = await deps.repository.getRoomByCode(String(payload.roomCode || ''));
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  if (room.expiresAt <= now) throw new AppError('ROOM_NOT_FOUND');

  await deps.repository.runRoomTransaction(room._id, async (tx) => {
    const latest = await tx.getRoom();
    if (!latest) throw new AppError('ROOM_NOT_FOUND');
    if (latest.expiresAt <= now) throw new AppError('ROOM_NOT_FOUND');

    const nextRoom = addPlayer(latest, {
      openid: context.openid,
      nickname: payload.nickname || defaultNickname(context.openid),
      avatarUrl: payload.avatarUrl || ''
    }, now);
    if (latest.players.length === 0 && !latest.ownerOpenid) {
      nextRoom.ownerOpenid = context.openid;
    }

    await tx.updateRoom(toRoomPatch(nextRoom));
    await syncRoomViewsWith(tx, nextRoom, now);
    return nextRoom;
  });

  return { roomId: room._id, roomCode: room.roomCode };
};
