function clone(value) {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value));
}

function withoutId(value) {
  const { _id, ...data } = value;
  return data;
}

function createMemoryRepository() {
  const rooms = new Map();
  const views = new Map();
  const hands = new Map();

  return {
    async createRoom(room) {
      rooms.set(room._id, clone(room));
    },

    async getRoom(roomId) {
      return clone(rooms.get(roomId) || null);
    },

    async getRoomByCode(roomCode) {
      const room = Array.from(rooms.values()).find((item) => item.roomCode === roomCode);
      return clone(room || null);
    },

    async listExpiredRooms(now) {
      return Array.from(rooms.values())
        .filter((room) => room.expiresAt < now)
        .map(clone);
    },

    async updateRoom(roomId, patch) {
      const current = rooms.get(roomId);
      if (!current) {
        const error = new Error('ROOM_NOT_FOUND');
        error.code = 'ROOM_NOT_FOUND';
        throw error;
      }
      rooms.set(roomId, { ...current, ...clone(withoutId(patch)) });
    },

    async saveRoomView(view) {
      views.set(view._id, clone(view));
    },

    async removeRoomView(roomId, openid) {
      views.delete(`${roomId}_${openid}`);
    },

    async listRoomViews(roomId) {
      return Array.from(views.values())
        .filter((view) => view.roomId === roomId)
        .map(clone);
    },

    async saveHand(hand) {
      hands.set(hand._id, clone(hand));
    },

    async getHand(roomId, roundNumber, openid) {
      const key = `${roomId}_${roundNumber}_${openid}`;
      return clone(hands.get(key) || null);
    },

    async runRoomTransaction(roomId, mutator) {
      const roomSnapshot = clone(Array.from(rooms.entries()));
      const viewSnapshot = clone(Array.from(views.entries()));
      const handSnapshot = clone(Array.from(hands.entries()));

      const tx = {
        async getRoom() {
          return clone(rooms.get(roomId) || null);
        },
        async updateRoom(patch) {
          const current = rooms.get(roomId);
          rooms.set(roomId, { ...current, ...clone(withoutId(patch)) });
        },
        async saveRoomView(view) {
          views.set(view._id, clone(view));
        },
        async removeRoomView(roomId, openid) {
          views.delete(`${roomId}_${openid}`);
        },
        async saveHand(hand) {
          hands.set(hand._id, clone(hand));
        }
      };

      try {
        return await mutator(tx);
      } catch (error) {
        rooms.clear();
        roomSnapshot.forEach(([key, value]) => rooms.set(key, value));
        views.clear();
        viewSnapshot.forEach(([key, value]) => views.set(key, value));
        hands.clear();
        handSnapshot.forEach(([key, value]) => hands.set(key, value));
        throw error;
      }
    },

    async removeRoomCascade(roomId) {
      rooms.delete(roomId);
      for (const [key, value] of views.entries()) {
        if (value.roomId === roomId) views.delete(key);
      }
      for (const [key, value] of hands.entries()) {
        if (value.roomId === roomId) hands.delete(key);
      }
    }
  };
}

module.exports = { createMemoryRepository };
