const test = require('node:test');
const assert = require('node:assert/strict');
const { watchRoomView, watchHand } = require('../miniprogram/services/watchers');

function installWatcherMocks() {
  const queries = [];
  global.wx = {
    cloud: {
      database() {
        return {
          collection(collectionName) {
            return {
              where(predicate) {
                queries.push({ collectionName, predicate });
                return {
                  watch() {
                    return { close() {} };
                  }
                };
              }
            };
          }
        };
      }
    }
  };
  return queries;
}

test('watchers include the equality fields required by CloudBase security rules', () => {
  const queries = installWatcherMocks();

  watchRoomView('room-1', 'owner', () => {}, () => {});
  watchHand('room-1', 3, 'owner', () => {}, () => {});

  assert.deepEqual(queries[0].collectionName, 'room_views');
  assert.deepEqual(queries[0].predicate, {
    _id: 'room-1_owner',
    roomId: 'room-1',
    openid: 'owner'
  });
  assert.deepEqual(queries[1].collectionName, 'hands');
  assert.deepEqual(queries[1].predicate, {
    _id: 'room-1_3_owner',
    roomId: 'room-1',
    roundNumber: 3,
    openid: 'owner'
  });

  delete global.wx;
});
