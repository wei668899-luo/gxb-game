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
});

test('table page exposes four slots and the ready action', () => {
  const wxml = read('miniprogram/pages/table/table.wxml');
  assert.equal((wxml.match(/data-index="\{\{index\}\}"/g) || []).length >= 1, true);
  assert.match(wxml, /bindtap="onToggleReady"/);
  assert.match(wxml, /bindtouchstart="onTouchStart"/);
});
