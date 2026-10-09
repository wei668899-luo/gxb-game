const { callRoomApi } = require('./cloud');

module.exports = {
  createRoom(profile) {
    return callRoomApi('createRoom', profile);
  },
  joinRoom(payload) {
    return callRoomApi('joinRoom', payload);
  },
  leaveRoom(roomId) {
    return callRoomApi('leaveRoom', { roomId });
  },
  setReady(roomId, ready) {
    return callRoomApi('setReady', { roomId, ready });
  },
  heartbeat(roomId) {
    return callRoomApi('heartbeat', { roomId });
  },
  dealRound(payload) {
    return callRoomApi('dealRound', payload);
  },
  arrangeHand(payload) {
    return callRoomApi('arrangeHand', payload);
  }
};
