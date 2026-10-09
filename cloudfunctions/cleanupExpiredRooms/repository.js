const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function createCleanupRepository() {
  return {
    async listExpiredRooms(now) {
      const command = db.command;
      const result = await db.collection('rooms')
        .where({ expiresAt: command.lt(now) })
        .get();
      return result.data;
    },

    async removeRoomCascade(roomId) {
      await db.collection('rooms').doc(roomId).remove();
      for (const collectionName of ['room_views', 'hands']) {
        const snapshot = await db.collection(collectionName).where({ roomId }).get();
        await Promise.all(snapshot.data.map((item) => (
          db.collection(collectionName).doc(item._id).remove()
        )));
      }
    }
  };
}

module.exports = { createCleanupRepository };
