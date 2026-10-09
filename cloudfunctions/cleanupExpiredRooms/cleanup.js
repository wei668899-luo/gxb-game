async function runCleanup(repository, now) {
  const expiredRooms = await repository.listExpiredRooms(now);
  const deletedRoomIds = [];

  for (const room of expiredRooms) {
    await repository.removeRoomCascade(room._id);
    deletedRoomIds.push(room._id);
  }

  return { deletedRoomIds };
}

module.exports = { runCleanup };
