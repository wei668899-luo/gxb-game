const ACTIVE_ROOM_KEY = 'activeRoom';

function getActiveRoom() {
  return wx.getStorageSync(ACTIVE_ROOM_KEY) || null;
}

function setActiveRoom(room) {
  wx.setStorageSync(ACTIVE_ROOM_KEY, {
    roomId: room.roomId,
    roomCode: room.roomCode
  });
}

function clearActiveRoom() {
  wx.removeStorageSync(ACTIVE_ROOM_KEY);
}

module.exports = { getActiveRoom, setActiveRoom, clearActiveRoom };
