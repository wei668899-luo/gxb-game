const { createRoomView } = require('./domain');

function toRoomPatch(room) {
  const { _id, ...patch } = room;
  return patch;
}

async function syncRoomView(repository, room, openid, now) {
  await repository.saveRoomView(createRoomView(room, openid, now));
}

async function syncRoomViews(repository, room, now) {
  await Promise.all(
    room.players.map((player) => syncRoomView(repository, room, player.openid, now))
  );
}

module.exports = {
  toRoomPatch,
  syncRoomView,
  syncRoomViews
};
