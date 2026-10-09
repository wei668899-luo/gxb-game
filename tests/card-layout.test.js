const test = require('node:test');
const assert = require('node:assert/strict');
const {
  swapSlots,
  findDropIndex
} = require('../miniprogram/utils/card-layout');

test('swapSlots swaps exactly two positions without mutating the source', () => {
  const source = ['a', 'b', 'c', 'd'];
  assert.deepEqual(swapSlots(source, 0, 3), ['d', 'b', 'c', 'a']);
  assert.deepEqual(source, ['a', 'b', 'c', 'd']);
});

test('findDropIndex returns the slot containing the touch point', () => {
  const rects = [
    { left: 0, top: 0, right: 100, bottom: 100 },
    { left: 110, top: 0, right: 210, bottom: 100 },
    { left: 0, top: 110, right: 100, bottom: 210 },
    { left: 110, top: 110, right: 210, bottom: 210 }
  ];

  assert.equal(findDropIndex(rects, { x: 50, y: 50 }), 0);
  assert.equal(findDropIndex(rects, { x: 150, y: 150 }), 3);
  assert.equal(findDropIndex(rects, { x: 500, y: 500 }), -1);
});
