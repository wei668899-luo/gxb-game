const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createRoomState,
  addPlayer,
  removePlayer,
  setPlayerReady,
  canDeal,
  createRoomView
} = require('../cloudfunctions/roomApi/lib/domain');

function room() {
  return createRoomState({
    roomId: 'room-1',
    roomCode: '123456',
    owner: {
      openid: 'owner',
      nickname: '房主',
      avatarUrl: ''
    },
    now: 1000
  });
}

test('createRoomState creates the owner seat and initial 54-card deck', () => {
  const state = room();
  assert.equal(state.ownerOpenid, 'owner');
  assert.equal(state.players.length, 1);
  assert.equal(state.roundNumber, 0);
  assert.equal(state.deckRemaining.length, 54);
});

test('addPlayer rejects a fourteenth player and duplicate openid', () => {
  let state = room();
  for (let index = 1; index < 13; index += 1) {
    state = addPlayer(state, {
      openid: `p-${index}`,
      nickname: `玩家${index}`,
      avatarUrl: ''
    }, 1000 + index);
  }

  assert.throws(
    () => addPlayer(state, { openid: 'p-14', nickname: '玩家14', avatarUrl: '' }, 2000),
    /ROOM_FULL/
  );
  assert.throws(
    () => addPlayer(state, { openid: 'owner', nickname: '重复', avatarUrl: '' }, 2000),
    /ALREADY_JOINED/
  );
});

test('players joining during a round wait for the next round', () => {
  let state = room();
  state = addPlayer(state, { openid: 'p-2', nickname: '玩家2', avatarUrl: '' }, 1001);
  state = { ...state, status: 'playing', roundNumber: 1 };
  state = addPlayer(state, { openid: 'p-3', nickname: '玩家3', avatarUrl: '' }, 1002);
  assert.equal(state.players.find((player) => player.openid === 'p-3').joinedRound, 2);
  assert.equal(createRoomView(state, 'p-3', 1003).waitingForNextRound, true);
});

test('canDeal requires two players and all-ready after the first round', () => {
  let state = room();
  assert.equal(canDeal(state), false);
  state = addPlayer(state, { openid: 'p-2', nickname: '玩家2', avatarUrl: '' }, 1001);
  assert.equal(canDeal(state), true);

  state = { ...state, status: 'playing', roundNumber: 1 };
  assert.equal(canDeal(state), false);
  state = setPlayerReady(state, 'owner', true);
  assert.equal(canDeal(state), false);
  state = setPlayerReady(state, 'p-2', true);
  assert.equal(canDeal(state), true);
});

test('removePlayer transfers ownership to the earliest remaining player', () => {
  let state = room();
  state = addPlayer(state, { openid: 'p-2', nickname: '玩家2', avatarUrl: '' }, 1001);
  state = removePlayer(state, 'owner');
  assert.equal(state.ownerOpenid, 'p-2');
  assert.equal(state.players.length, 1);
});

test('createRoomView exposes public state and only the requested hand flag', () => {
  let state = room();
  state = addPlayer(state, { openid: 'p-2', nickname: '玩家2', avatarUrl: '' }, 1001);
  state = { ...state, status: 'playing', roundNumber: 1 };
  const view = createRoomView(state, 'owner', 1100);
  assert.equal(view.openid, 'owner');
  assert.equal(view.canDeal, false);
  assert.equal(view.players.find((player) => player.openid === 'owner').hasHand, true);
  assert.equal(view.players.find((player) => player.openid === 'p-2').hasHand, true);
});
