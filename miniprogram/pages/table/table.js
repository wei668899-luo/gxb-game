const app = getApp();
const roomApi = require('../../services/room-api');
const {
  getActiveRoom,
  clearActiveRoom
} = require('../../services/session');
const {
  watchRoomView,
  watchHand
} = require('../../services/watchers');
const {
  swapSlots,
  findDropIndex
} = require('../../utils/card-layout');
const { newRequestId } = require('../../utils/validation');

const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const SUIT_TEXT = {
  S: '♠',
  H: '♥',
  C: '♣',
  D: '♦',
  JOKER: '★'
};

function cardView(card) {
  const isJoker = card.suit === 'JOKER';
  return {
    ...card,
    rank: isJoker ? (card.rank === 'BIG' ? '大王' : '小王') : card.rank,
    suitText: isJoker ? '' : SUIT_TEXT[card.suit],
    isRed: card.suit === 'H' || card.suit === 'D' || card.id === 'JOKER-BIG'
  };
}

function showError(error) {
  wx.showToast({
    title: error.message || '操作失败',
    icon: 'none'
  });
}

function isValidSlotRects(rects) {
  return Array.isArray(rects) && rects.length === 4 && rects.every((rect) => (
    rect &&
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    Number.isFinite(rect.right) &&
    Number.isFinite(rect.bottom) &&
    rect.right >= rect.left &&
    rect.bottom >= rect.top
  ));
}

Page({
  data: {
    roomId: '',
    openid: '',
    room: {
      roomCode: '',
      players: [],
      roundNumber: 0,
      remainingDeckCount: 0
    },
    hasHand: false,
    waitingForNextRound: false,
    slots: [],
    draggingIndex: -1,
    dropIndex: -1,
    isOwner: false,
    dealing: false,
    ownReady: false,
    savingReady: false
  },

  async onLoad(options) {
    const activeRoom = getActiveRoom();
    const roomId = options.roomId || app.globalData.activeRoomId || (activeRoom && activeRoom.roomId);
    if (!roomId) {
      wx.reLaunch({ url: '/pages/index/index' });
      return;
    }

    this.setData({ roomId });
    try {
      const result = await roomApi.heartbeat(roomId);
      this.setData({ openid: result.openid });
      this.startRoomWatch();
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

  onReady() {
    this.measureSlots();
  },

  onShow() {
    if (this.data.roomId) this.startHeartbeat();
  },

  onHide() {
    this.stopHeartbeat();
  },

  startRoomWatch() {
    this.roomWatcher = watchRoomView(
      this.data.roomId,
      this.data.openid,
      (room) => {
        const ownPlayer = room.players.find((player) => player.openid === this.data.openid);
        const hasHand = Boolean(ownPlayer && ownPlayer.hasHand);
        const waitingForNextRound = Boolean(room.waitingForNextRound);
        this.setData({
          room,
          hasHand,
          waitingForNextRound,
          isOwner: room.ownerOpenid === this.data.openid,
          ownReady: Boolean(ownPlayer && ownPlayer.ready)
        });

        if (hasHand && room.roundNumber !== this.watchedRound) {
          this.startHandWatch(room.roundNumber);
        }
      },
      showError
    );
  },

  startHandWatch(roundNumber) {
    if (this.handWatcher) this.handWatcher.close();
    this.watchedRound = roundNumber;
    this.handWatcher = watchHand(
      this.data.roomId,
      roundNumber,
      this.data.openid,
      (hand) => this.applyHand(hand),
      showError
    );
  },

  applyHand(hand) {
    const byId = new Map(hand.cards.map((card) => [card.id, card]));
    this.setData({
      slots: hand.slots.map((id) => cardView(byId.get(id)))
    }, () => {
      this.measureSlots();
    });
  },

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      roomApi.heartbeat(this.data.roomId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  },

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  },

  measureSlots() {
    wx.createSelectorQuery()
      .selectAll('.card-slot')
      .boundingClientRect((rects) => {
        this.slotRects = rects || [];
      })
      .exec();
  },

  onTouchStart(event) {
    this.setData({
      draggingIndex: Number(event.currentTarget.dataset.index),
      dropIndex: -1
    });
    wx.vibrateShort({ type: 'light' });
  },

  onTouchMove(event) {
    if (this.data.draggingIndex < 0) return;
    if (!isValidSlotRects(this.slotRects)) {
      this.measureSlots();
      return;
    }
    const touch = event.touches[0];
    const dropIndex = findDropIndex(this.slotRects, {
      x: touch.clientX,
      y: touch.clientY
    });
    if (dropIndex !== this.data.dropIndex) this.setData({ dropIndex });
  },

  async onTouchEnd() {
    const fromIndex = this.data.draggingIndex;
    const toIndex = this.data.dropIndex;
    this.setData({ draggingIndex: -1, dropIndex: -1 });

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const previous = this.data.slots;
    const nextSlots = swapSlots(previous, fromIndex, toIndex);
    this.setData({ slots: nextSlots });

    try {
      await roomApi.arrangeHand({
        roomId: this.data.roomId,
        roundNumber: this.data.room.roundNumber,
        slots: nextSlots.map((card) => card.id)
      });
      wx.vibrateShort({ type: 'light' });
    } catch (error) {
      this.setData({ slots: previous });
      showError(error);
    }
  },

  async onToggleReady() {
    if (this.data.savingReady) return;
    this.setData({ savingReady: true });
    try {
      const result = await roomApi.setReady(
        this.data.roomId,
        !this.data.ownReady
      );
      this.setData({ ownReady: result.ready });
    } catch (error) {
      showError(error);
    } finally {
      this.setData({ savingReady: false });
    }
  },

  async onStartNextDeal() {
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
    if (this.handWatcher) this.handWatcher.close();
    this.stopHeartbeat();
  }
});
