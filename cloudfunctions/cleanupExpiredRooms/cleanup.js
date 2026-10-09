async function runCleanup(repository, now) {
  const expiredRooms = await repository.listExpiredRooms(now);
  const deletedRoomIds = [];

  for (const room of expiredRooms) {
    const currentRoom = await repository.getRoom(room._id);
    if (!currentRoom || currentRoom.expiresAt > now) continue;
    await repository.removeRoomCascade(currentRoom._id);
    deletedRoomIds.push(currentRoom._id);
  }

  return { deletedRoomIds };
}

module.exports = { runCleanup };
