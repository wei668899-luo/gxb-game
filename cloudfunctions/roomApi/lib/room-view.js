const { createRoomView } = require('./domain');

function toRoomPatch(room) {
  const { _id, ...patch } = room;
  return patch;
}

async function syncRoomViewsWith(target, room, now) {
  for (const player of room.players) {
    await target.saveRoomView(createRoomView(room, player.openid, now));
  }
}

async function syncRoomViews(repository, room, now) {
  await syncRoomViewsWith(repository, room, now);
}

module.exports = {
  toRoomPatch,
  syncRoomViewsWith,
  syncRoomViews
};
