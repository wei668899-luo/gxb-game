const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function docId(roomId, openid, roundNumber) {
  return roundNumber === undefined
    ? `${roomId}_${openid}`
    : `${roomId}_${roundNumber}_${openid}`;
}

function withoutId(value) {
  const { _id, ...data } = value;
  return data;
}

async function getOne(collectionName, predicate) {
  const result = await db.collection(collectionName).where(predicate).limit(1).get();
  return result.data[0] || null;
}

function createCloudRepository() {
  return {
    async createRoom(room) {
      await db.collection('rooms').doc(room._id).set({ data: withoutId(room) });
    },

    async getRoom(roomId) {
      try {
        const result = await db.collection('rooms').doc(roomId).get();
        return result.data || null;
      } catch (error) {
        if (error.errCode === -1 || /not exist/i.test(error.message || '')) {
          return null;
        }
        throw error;
      }
    },

    getRoomByCode(roomCode) {
      return getOne('rooms', { roomCode });
    },

    async listExpiredRooms(now) {
      const command = db.command;
      const result = await db.collection('rooms')
        .where({ expiresAt: command.lt(now) })
        .get();
      return result.data;
    },

    async updateRoom(roomId, patch) {
      await db.collection('rooms').doc(roomId).update({ data: withoutId(patch) });
    },

    async saveRoomView(view) {
      await db.collection('room_views').doc(view._id).set({ data: withoutId(view) });
    },

    async removeRoomView(roomId, openid) {
      await db.collection('room_views').doc(docId(roomId, openid)).remove();
    },

    async listRoomViews(roomId) {
      const result = await db.collection('room_views').where({ roomId }).get();
      return result.data;
    },

    async saveHand(hand) {
      await db.collection('hands').doc(hand._id).set({ data: withoutId(hand) });
    },

    getHand(roomId, roundNumber, openid) {
      return getOne('hands', { roomId, roundNumber, openid });
    },

    async runRoomTransaction(roomId, mutator) {
      return db.runTransaction(async (transaction) => {
        const tx = {
          async getRoom() {
            const result = await transaction.collection('rooms').doc(roomId).get();
            return result.data || null;
          },
          async updateRoom(patch) {
            await transaction.collection('rooms').doc(roomId).update({ data: withoutId(patch) });
          },
          async saveRoomView(view) {
            await transaction.collection('room_views')
              .doc(view._id)
              .set({ data: withoutId(view) });
          },
          async saveHand(hand) {
            await transaction.collection('hands')
              .doc(hand._id)
              .set({ data: withoutId(hand) });
          }
        };

        return mutator(tx);
      });
    },

    async removeRoomCascade(roomId) {
      await db.collection('rooms').doc(roomId).remove();
      const collections = ['room_views', 'hands'];
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).where({ roomId }).get();
        await Promise.all(snapshot.data.map((item) => (
          db.collection(collectionName).doc(item._id).remove()
        )));
      }
    }
  };
}

module.exports = {
  createCloudRepository,
  docId
};
