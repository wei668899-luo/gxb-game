const test = require('node:test');
const assert = require('node:assert/strict');

const appState = { globalData: { activeRoomId: 'room-1' } };
let pageDefinition;

global.getApp = () => appState;
global.Page = (definition) => {
  pageDefinition = definition;
};
global.wx = {
  getStorageSync() { return null; },
  setStorageSync() {},
  removeStorageSync() {},
  showToast() {},
  reLaunch() {},
  showModal() {}
};

const roomApi = require('../miniprogram/services/room-api');
require('../miniprogram/pages/table/table');

function createPage() {
  return {
    ...pageDefinition,
    data: {
      roomId: 'room-1',
      openid: '',
      room: { roomCode: '', players: [], roundNumber: 0, remainingDeckCount: 0 },
      slots: [],
      draggingIndex: -1,
      dropIndex: -1,
      isOwner: false,
      dealing: false,
      ownReady: false,
      savingReady: false
    },
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    }
  };
}

test('table load failure clears active-room state and returns to the index', async () => {
  let relaunchUrl = '';
  let delayedNavigation = null;
  const originalSetTimeout = global.setTimeout;
  const originalHeartbeat = roomApi.heartbeat;

  global.setTimeout = (callback) => {
    delayedNavigation = callback;
    return 1;
  };
  global.wx.reLaunch = ({ url }) => {
    relaunchUrl = url;
  };
  roomApi.heartbeat = async () => {
    throw new Error('bad');
  };

  await pageDefinition.onLoad.call(createPage(), {});

  assert.equal(appState.globalData.activeRoomId, '');
  assert.equal(typeof delayedNavigation, 'function');
  delayedNavigation();
  assert.equal(relaunchUrl, '/pages/index/index');

  global.setTimeout = originalSetTimeout;
  roomApi.heartbeat = originalHeartbeat;
});

test('table heartbeat is replaced on show and stopped on hide', async () => {
  let activeIntervals = 0;
  let clearedIntervals = 0;
  let intervalCallback = null;
  let heartbeatCalls = 0;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const originalHeartbeat = roomApi.heartbeat;

  global.setInterval = (callback, intervalMs) => {
    assert.equal(intervalMs, 60 * 1000);
    intervalCallback = callback;
    activeIntervals += 1;
    return activeIntervals;
  };
  global.clearInterval = () => {
    clearedIntervals += 1;
    activeIntervals = 0;
  };
  roomApi.heartbeat = async () => {
    heartbeatCalls += 1;
  };

  const page = createPage();
  pageDefinition.onShow.call(page);
  assert.equal(activeIntervals, 1);
  await intervalCallback();
  assert.equal(heartbeatCalls, 1);

  pageDefinition.onShow.call(page);
  assert.equal(activeIntervals, 1);
  assert.equal(clearedIntervals, 1);
  await intervalCallback();
  assert.equal(heartbeatCalls, 2);

  pageDefinition.onHide.call(page);
  assert.equal(activeIntervals, 0);
  assert.equal(clearedIntervals, 2);

  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  roomApi.heartbeat = originalHeartbeat;
});
