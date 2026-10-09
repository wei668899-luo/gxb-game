const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoomCode,
  validateRoomCode,
  newRequestId
} = require('../miniprogram/utils/validation');

test('normalizeRoomCode keeps digits and limits length to six', () => {
  assert.equal(normalizeRoomCode(' 12a34-567 '), '123456');
  assert.equal(validateRoomCode('123456'), true);
  assert.equal(validateRoomCode('12345'), false);
});

test('newRequestId creates a non-empty unique identifier', () => {
  const first = newRequestId();
  const second = newRequestId();
  assert.equal(typeof first, 'string');
  assert.equal(first.length > 10, true);
  assert.notEqual(first, second);
});
