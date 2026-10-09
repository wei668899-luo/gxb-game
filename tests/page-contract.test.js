const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('home page exposes create and join actions', () => {
  const wxml = read('miniprogram/pages/index/index.wxml');
  assert.match(wxml, /bindtap="onCreateRoom"/);
  assert.match(wxml, /bindtap="onJoinRoom"/);
  assert.match(wxml, /type="number"/);
});

test('room page exposes owner dealing, sharing, and leaving', () => {
  const wxml = read('miniprogram/pages/room/room.wxml');
  assert.match(wxml, /bindtap="onStartDeal"/);
  assert.match(wxml, /open-type="share"/);
  assert.match(wxml, /bindtap="onLeaveRoom"/);
  assert.match(wxml, /item\.online \? '在线' : '离线'/);
});

test('table page exposes four slots, the ready action, and leave control', () => {
  const wxml = read('miniprogram/pages/table/table.wxml');
  assert.equal((wxml.match(/data-index="\{\{index\}\}"/g) || []).length >= 1, true);
  assert.match(wxml, /bindtap="onToggleReady"/);
  assert.match(wxml, /bindtouchstart="onTouchStart"/);
  assert.match(wxml, /bindtap="onLeaveRoom"/);
});

test('table page starts and stops heartbeat with its page lifecycle', () => {
  const js = read('miniprogram/pages/table/table.js');
  assert.match(js, /60 \* 1000/);
  assert.match(js, /startHeartbeat\(\)/);
  assert.match(js, /stopHeartbeat\(\)/);
  assert.match(js, /onShow\(\)/);
  assert.match(js, /onHide\(\)/);
  assert.match(js, /wx\.reLaunch\(\{ url: '\/pages\/index\/index' \}\)/);
});
