const app = getApp();
const roomApi = require('../../services/room-api');
const { getActiveRoom, setActiveRoom } = require('../../services/session');
const {
  normalizeRoomCode,
  validateRoomCode
} = require('../../utils/validation');

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}

async function requestProfile() {
  if (!wx.getUserProfile) return { nickname: '', avatarUrl: '' };
  return new Promise((resolve) => {
    wx.getUserProfile({
      desc: '用于在牌局房间内显示玩家身份',
      success: (result) => resolve({
        nickname: result.userInfo.nickName,
        avatarUrl: result.userInfo.avatarUrl
      }),
      fail: () => resolve({ nickname: '', avatarUrl: '' })
    });
  });
}

Page({
  data: {
    roomCode: '',
    activeRoom: null,
    loading: false
  },

  onLoad(options) {
    const roomCode = normalizeRoomCode(options.roomCode);
    if (roomCode) {
      this.setData({ roomCode });
      return;
    }

    const activeRoom = getActiveRoom();
    if (activeRoom && activeRoom.roomId) this.setData({ activeRoom });
  },

  onShow() {
    const activeRoom = getActiveRoom();
    this.setData({ activeRoom: activeRoom && activeRoom.roomId ? activeRoom : null });
  },

  onContinueRoom() {
    if (!this.data.activeRoom) return;
    wx.navigateTo({
      url: `/pages/room/room?roomId=${this.data.activeRoom.roomId}`
    });
  },

  onRoomCodeInput(event) {
    this.setData({ roomCode: normalizeRoomCode(event.detail.value) });
  },

  async onCreateRoom() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    try {
      const profile = await requestProfile();
      const result = await roomApi.createRoom(profile);
      app.globalData.activeRoomId = result.roomId;
      app.globalData.activeRoomCode = result.roomCode;
      setActiveRoom(result);
      wx.navigateTo({ url: `/pages/room/room?roomId=${result.roomId}` });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  },

  async onJoinRoom() {
    if (this.data.loading) return;
    if (!validateRoomCode(this.data.roomCode)) {
      showError(new Error('请输入 6 位房间号'));
      return;
    }

    this.setData({ loading: true });
    try {
      const profile = await requestProfile();
      const result = await roomApi.joinRoom({
        roomCode: this.data.roomCode,
        ...profile
      });
      app.globalData.activeRoomId = result.roomId;
      app.globalData.activeRoomCode = result.roomCode;
      setActiveRoom(result);
      wx.navigateTo({ url: `/pages/room/room?roomId=${result.roomId}` });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ loading: false });
    }
  }
});
