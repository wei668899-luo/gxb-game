const app = getApp();
const roomApi = require('../../services/room-api');
const {
  getActiveRoom,
  clearActiveRoom
} = require('../../services/session');
const { watchRoomView } = require('../../services/watchers');
const { newRequestId } = require('../../utils/validation');

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}

Page({
  data: {
    roomId: '',
    openid: '',
    room: {
      roomCode: '',
      players: [],
      roundNumber: 0,
      canDeal: false
    },
    isOwner: false,
    dealing: false
  },

  async onLoad(options) {
    const activeRoom = getActiveRoom();
    const roomId = options.roomId || app.globalData.activeRoomId || (activeRoom && activeRoom.roomId);
    if (!roomId) {
      wx.showModal({
        title: '房间不存在',
        content: '请重新创建或加入房间。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }

    this.setData({ roomId });
    try {
      const result = await roomApi.heartbeat(roomId);
      this.setData({ openid: result.openid });
      this.startWatch(result.openid);
      this.startHeartbeat();
    } catch (error) {
      if (error.code === 'ROOM_NOT_FOUND' || error.code === 'PLAYER_NOT_FOUND') {
        clearActiveRoom();
        app.globalData.activeRoomId = '';
      }
      showError(error);
      setTimeout(() => wx.reLaunch({ url: '/pages/index/index' }), 800);
    }
  },

  startWatch(openid) {
    if (this.roomWatcher) this.roomWatcher.close();
    this.roomWatcher = watchRoomView(
      this.data.roomId,
      openid,
      (room) => {
        this.setData({
          room,
          isOwner: room.ownerOpenid === openid
        });
        if (room.roundNumber > 0 && !this.navigatingToTable) {
          this.navigatingToTable = true;
          wx.redirectTo({ url: `/pages/table/table?roomId=${this.data.roomId}` });
        }
      },
      showError
    );
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      roomApi.heartbeat(this.data.roomId).catch(() => {});
    }, 60 * 1000);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  },

  async onStartDeal() {
    if (this.data.dealing) return;
    this.setData({ dealing: true });
    try {
      await roomApi.dealRound({
        roomId: this.data.roomId,
        expectedRoundNumber: this.data.room.roundNumber,
        requestId: newRequestId()
      });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ dealing: false });
    }
  },

  onShareAppMessage() {
    return {
      title: `加入水鱼房间 ${this.data.room.roomCode}`,
      path: `/pages/index/index?roomCode=${this.data.room.roomCode}`
    };
  },

  onLeaveRoom() {
    wx.showModal({
      title: '退出房间',
      content: '退出后将移除你的席位。',
      success: async (result) => {
        if (!result.confirm) return;
        try {
          await roomApi.leaveRoom(this.data.roomId);
          app.globalData.activeRoomId = '';
          clearActiveRoom();
          wx.reLaunch({ url: '/pages/index/index' });
        } catch (error) {
          showError(error);
        }
      }
    });
  },

  onUnload() {
    if (this.roomWatcher) this.roomWatcher.close();
    this.stopHeartbeat();
  }
});
