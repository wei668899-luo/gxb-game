# 广西水鱼扑克牌微信小程序 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成一个原生微信小程序，支持 2～13 人建房、持续使用一副 54 张牌发牌、每人私密获得 4 张牌，并在固定 2×2 四格中拖动换位。

**Architecture:** 原生微信小程序负责页面、实时监听和触摸拖动；单个 `roomApi` 云函数提供所有房间动作；定时 `cleanupExpiredRooms` 云函数清理过期房间。`rooms` 保持服务端权威数据和隐藏牌堆，`room_views` 与 `hands` 通过每名玩家的 `openid` 隔离，客户端无权读取其他人的数据。

**Tech Stack:** 微信原生小程序、微信云开发、云函数、云数据库实时监听、Node.js 内置测试运行器 `node:test`、CommonJS。

**Spec:** `docs/superpowers/specs/2026-10-09-shuiyu-poker-mini-program-design.md`

## Global Constraints

- 房间人数固定为 2～13 人。
- 扑克牌固定为 54 张：四种花色各 13 张，加大小王各 1 张。
- 每位参与本轮房间的玩家恰好获得 4 张牌。
- 底牌足够时继续使用；不足本轮所有玩家各 4 张时，重洗完整 54 张。
- 每名玩家只能读取自己的 4 张牌，其他玩家只能看到公开状态。
- 四个牌槽固定为 2×2，拖动到另一格时只交换两张牌。
- 首次发牌只要求至少 2 人；后续每轮要求房间内所有玩家都已准备。
- 房主退出时，房主身份自动转移给最早加入的剩余玩家。
- 发牌、洗牌、底牌变化和权限校验只能由云函数执行。
- 不实现比牌、大小判断、记分、输赢、聊天、语音或旁观。
- 房间无操作 24 小时后过期。
- 所有行为使用 `openid` 判定身份，客户端传入的玩家身份不可信。

## Execution Prerequisites

- 执行第一个任务前，需要有一个可用的小程序 AppID。
- 在微信开发者工具中开通云开发，并创建至少一个云环境。
- `project.config.json` 保留 `touristappid` 以便提交到仓库；联调前在开发者工具中切换到用户自己的 AppID。
- 云环境只使用一个时，客户端调用 `wx.cloud.init({ traceUser: true })` 并使用默认环境；存在多个环境时，在开发者工具中明确选择目标环境。

## File Structure

```text
.
├── .gitignore
├── package.json
├── project.config.json
├── miniprogram
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── sitemap.json
│   ├── services
│   │   ├── cloud.js
│   │   ├── room-api.js
│   │   ├── session.js
│   │   └── watchers.js
│   ├── utils
│   │   ├── validation.js
│   │   └── card-layout.js
│   └── pages
│       ├── index
│       │   ├── index.js
│       │   ├── index.json
│       │   ├── index.wxml
│       │   └── index.wxss
│       ├── room
│       │   ├── room.js
│       │   ├── room.json
│       │   ├── room.wxml
│       │   └── room.wxss
│       └── table
│           ├── table.js
│           ├── table.json
│           ├── table.wxml
│           └── table.wxss
├── cloudfunctions
│   ├── roomApi
│   │   ├── index.js
│   │   ├── package.json
│   │   ├── lib
│   │   │   ├── cards.js
│   │   │   ├── domain.js
│   │   │   ├── errors.js
│   │   │   ├── repository.js
│   │   │   └── room-view.js
│   │   └── handlers
│   │       ├── create-room.js
│   │       ├── join-room.js
│   │       ├── leave-room.js
│   │       ├── set-ready.js
│   │       ├── heartbeat.js
│   │       ├── deal-round.js
│   │       └── arrange-hand.js
│   └── cleanupExpiredRooms
│       ├── index.js
│       ├── repository.js
│       └── package.json
├── tests
│   ├── helpers
│   │   └── memory-repository.js
│   ├── smoke.test.js
│   ├── cards.test.js
│   ├── domain.test.js
│   ├── repository.test.js
│   ├── room-view.test.js
│   ├── dispatcher.test.js
│   ├── create-join-leave.test.js
│   ├── ready-heartbeat.test.js
│   ├── deal-round.test.js
│   ├── arrange-hand.test.js
│   ├── cleanup.test.js
│   ├── validation.test.js
│   ├── card-layout.test.js
│   └── page-contract.test.js
└── docs
    ├── cloudbase-setup.md
    ├── manual-test.md
    └── superpowers
        ├── specs
        │   └── 2026-10-09-shuiyu-poker-mini-program-design.md
        └── plans
            └── 2026-10-09-shuiyu-poker-mini-program.md
```

---

### Task 1: Scaffold the Mini Program and Test Runner

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `project.config.json`
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/sitemap.json`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Consumes: none.
- Produces: root command `npm test`; Mini Program roots `miniprogram/` and `cloudfunctions/`; application pages `pages/index/index`, `pages/room/room`, `pages/table/table`.

- [ ] **Step 1: Write the failing scaffold test**

Create `tests/smoke.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('mini program scaffold exposes required files and pages', () => {
  const required = [
    'project.config.json',
    'miniprogram/app.js',
    'miniprogram/app.json',
    'miniprogram/app.wxss',
    'miniprogram/sitemap.json'
  ];

  for (const relativePath of required) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
  }

  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')
  );

  assert.deepEqual(appConfig.pages, [
    'pages/index/index',
    'pages/room/room',
    'pages/table/table'
  ]);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/smoke.test.js`

Expected: FAIL because `project.config.json` or `miniprogram/app.js` does not exist.

- [ ] **Step 3: Create the scaffold**

Create `.gitignore`:

```gitignore
node_modules/
miniprogram_npm/
.DS_Store
project.private.config.json
cloudfunctions/*/node_modules/
coverage/
```

Create `package.json`:

```json
{
  "name": "guangxi-shuiyu-poker",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

Create `project.config.json`:

```json
{
  "appid": "touristappid",
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/",
  "setting": {
    "es6": true,
    "enhance": true,
    "postcss": true,
    "minified": true,
    "urlCheck": false
  },
  "condition": {}
}
```

Create `miniprogram/app.json`:

```json
{
  "pages": [
    "pages/index/index",
    "pages/room/room",
    "pages/table/table"
  ],
  "window": {
    "navigationBarTitleText": "广西水鱼",
    "navigationBarBackgroundColor": "#0f5132",
    "navigationBarTextStyle": "white",
    "backgroundColor": "#f3f0e8"
  },
  "sitemapLocation": "sitemap.json",
  "lazyCodeLoading": "requiredComponents"
}
```

Create `miniprogram/app.js`:

```js
App({
  globalData: {
    activeRoomId: '',
    activeRoomCode: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({
        title: '版本过低',
        content: '请升级微信后再使用本小程序。',
        showCancel: false
      });
      return;
    }

    wx.cloud.init({ traceUser: true });
  }
});
```

Create `miniprogram/app.wxss`:

```css
page {
  min-height: 100%;
  background: #f3f0e8;
  color: #18251f;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

button::after {
  border: 0;
}

.page-shell {
  min-height: 100vh;
  padding: 40rpx 32rpx calc(40rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.primary-button {
  height: 96rpx;
  border-radius: 16rpx;
  background: #0f5132;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 600;
}

.secondary-button {
  height: 96rpx;
  border-radius: 16rpx;
  background: #ffffff;
  color: #0f5132;
  border: 2rpx solid #0f5132;
  font-size: 34rpx;
  font-weight: 600;
}

.muted {
  color: #66756d;
}
```

Create `miniprogram/sitemap.json`:

```json
{
  "desc": "广西水鱼扑克牌房间工具",
  "rules": [
    {
      "action": "allow",
      "page": "*"
    }
  ]
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test tests/smoke.test.js`

Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json project.config.json miniprogram tests/smoke.test.js
git commit -m "chore: scaffold mini program"
```

---

### Task 2: Implement the 54-Card Deck and Continuous Dealing

**Files:**
- Create: `cloudfunctions/roomApi/lib/cards.js`
- Test: `tests/cards.test.js`

**Interfaces:**
- Consumes: none.
- Produces: `createDeck(): Card[]`; `shuffle(cards, random): Card[]`; `drawRound(deck, playerCount, random): { hands: Card[][], remainingDeck: Card[], reshuffled: boolean }`.

Card shape:

```js
{
  id: 'S-A' | 'H-10' | 'C-K' | 'D-2' | 'JOKER-SMALL' | 'JOKER-BIG',
  rank: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'SMALL' | 'BIG',
  suit: 'S' | 'H' | 'C' | 'D' | 'JOKER'
}
```

- [ ] **Step 1: Write the failing card tests**

Create `tests/cards.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createDeck,
  shuffle,
  drawRound
} = require('../cloudfunctions/roomApi/lib/cards');

test('createDeck returns exactly 54 unique cards', () => {
  const deck = createDeck();
  assert.equal(deck.length, 54);
  assert.equal(new Set(deck.map((card) => card.id)).size, 54);
  assert.equal(deck.filter((card) => card.suit === 'JOKER').length, 2);
});

test('shuffle does not mutate the source deck', () => {
  const deck = createDeck();
  const original = deck.map((card) => card.id);
  const shuffled = shuffle(deck, () => 0);
  assert.deepEqual(deck.map((card) => card.id), original);
  assert.notDeepEqual(shuffled.map((card) => card.id), original);
});

test('drawRound continues from the remaining deck when enough cards exist', () => {
  const deck = createDeck();
  const first = drawRound(deck, 4, () => 0.5);
  assert.equal(first.hands.length, 4);
  assert.equal(first.hands.every((hand) => hand.length === 4), true);
  assert.equal(first.remainingDeck.length, 38);
  assert.equal(first.reshuffled, false);

  const second = drawRound(first.remainingDeck, 4, () => 0.5);
  assert.equal(second.remainingDeck.length, 22);
  assert.equal(second.reshuffled, false);

  const third = drawRound(second.remainingDeck, 4, () => 0.5);
  assert.equal(third.remainingDeck.length, 6);
  assert.equal(third.reshuffled, false);

  const fourth = drawRound(third.remainingDeck, 4, () => 0.5);
  assert.equal(fourth.remainingDeck.length, 38);
  assert.equal(fourth.reshuffled, true);
});

test('drawRound reshuffles 54 cards when the remaining deck is insufficient', () => {
  const shortDeck = createDeck().slice(0, 6);
  const result = drawRound(shortDeck, 4, () => 0.5);
  assert.equal(result.hands.length, 4);
  assert.equal(result.hands.flat().length, 16);
  assert.equal(result.remainingDeck.length, 38);
  assert.equal(result.reshuffled, true);
  assert.equal(new Set(result.hands.flat().map((card) => card.id)).size, 16);
});

test('13 players leave two cards and force a reshuffle on the next round', () => {
  const first = drawRound(createDeck(), 13, () => 0.5);
  assert.equal(first.remainingDeck.length, 2);
  assert.equal(first.reshuffled, false);

  const second = drawRound(first.remainingDeck, 13, () => 0.5);
  assert.equal(second.remainingDeck.length, 2);
  assert.equal(second.reshuffled, true);
  assert.equal(second.hands.flat().length, 52);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/cards.test.js`

Expected: FAIL with `Cannot find module '../cloudfunctions/roomApi/lib/cards'`.

- [ ] **Step 3: Implement the card module**

Create `cloudfunctions/roomApi/lib/cards.js`:

```js
const crypto = require('node:crypto');

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'C', 'D'];

function secureRandom() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function createDeck() {
  const cards = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: `${suit}-${rank}`, rank, suit });
    }
  }

  cards.push({ id: 'JOKER-SMALL', rank: 'SMALL', suit: 'JOKER' });
  cards.push({ id: 'JOKER-BIG', rank: 'BIG', suit: 'JOKER' });
  return cards;
}

function shuffle(cards, random = secureRandom) {
  const result = cards.slice();

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function drawRound(deck, playerCount, random = secureRandom) {
  const needed = playerCount * 4;
  const reshuffled = deck.length < needed;
  const sourceDeck = reshuffled ? shuffle(createDeck(), random) : deck.slice();
  const drawn = sourceDeck.slice(0, needed);
  const hands = [];

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    hands.push(drawn.slice(playerIndex * 4, playerIndex * 4 + 4));
  }

  return {
    hands,
    remainingDeck: sourceDeck.slice(needed),
    reshuffled
  };
}

module.exports = {
  createDeck,
  shuffle,
  drawRound
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/cards.test.js`

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/lib/cards.js tests/cards.test.js
git commit -m "feat: add 54-card deck dealing"
```

---

### Task 3: Implement Room Domain Rules

**Files:**
- Create: `cloudfunctions/roomApi/lib/domain.js`
- Test: `tests/domain.test.js`

**Interfaces:**
- Consumes: none.
- Produces: `createRoomState(input): Room`; `addPlayer(room, player, now): Room`; `removePlayer(room, openid): Room`; `setPlayerReady(room, openid, ready): Room`; `canDeal(room): boolean`; `createRoomView(room, openid): RoomView`.

Room shape includes `_id`, `roomCode`, `ownerOpenid`, `status`, `players`, `roundNumber`, `deckRemaining`, `deckGeneration`, `readyOpenids`, `createdAt`, `updatedAt`, and `expiresAt`.

Player shape:

```js
{
  openid: 'openid-a',
  nickname: '玩家1234',
  avatarUrl: '',
  joinedRound: 1,
  ready: false,
  lastSeenAt: 1760000000000
}
```

- [ ] **Step 1: Write the failing domain tests**

Create `tests/domain.test.js`:

```js
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/domain.test.js`

Expected: FAIL with `Cannot find module '../cloudfunctions/roomApi/lib/domain'`.

- [ ] **Step 3: Implement the room domain module**

Create `cloudfunctions/roomApi/lib/domain.js`:

```js
const { createDeck, shuffle } = require('./cards');

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 13;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function createRoomState({ roomId, roomCode, owner, now }) {
  const ownerPlayer = {
    openid: owner.openid,
    nickname: owner.nickname,
    avatarUrl: owner.avatarUrl || '',
    joinedRound: 1,
    ready: false,
    lastSeenAt: now
  };

  return {
    _id: roomId,
    roomCode,
    ownerOpenid: owner.openid,
    status: 'waiting',
    players: [ownerPlayer],
    roundNumber: 0,
    deckRemaining: shuffle(createDeck()),
    deckGeneration: 1,
    readyOpenids: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ROOM_TTL_MS
  };
}

function addPlayer(room, player, now) {
  if (room.players.some((item) => item.openid === player.openid)) {
    fail('ALREADY_JOINED');
  }
  if (room.players.length >= MAX_PLAYERS) {
    fail('ROOM_FULL');
  }

  const joinedRound = room.status === 'playing' ? room.roundNumber + 1 : 1;
  return {
    ...room,
    players: [
      ...room.players,
      {
        openid: player.openid,
        nickname: player.nickname,
        avatarUrl: player.avatarUrl || '',
        joinedRound,
        ready: false,
        lastSeenAt: now
      }
    ],
    updatedAt: now,
    expiresAt: now + ROOM_TTL_MS
  };
}

function removePlayer(room, openid) {
  const players = room.players.filter((player) => player.openid !== openid);
  const ownerOpenid = room.ownerOpenid === openid
    ? (players[0] ? players[0].openid : '')
    : room.ownerOpenid;

  return {
    ...room,
    ownerOpenid,
    players,
    readyOpenids: room.readyOpenids.filter((item) => item !== openid)
  };
}

function setPlayerReady(room, openid, ready) {
  if (!room.players.some((player) => player.openid === openid)) {
    fail('PLAYER_NOT_FOUND');
  }

  const readyOpenids = new Set(room.readyOpenids);
  if (ready) {
    readyOpenids.add(openid);
  } else {
    readyOpenids.delete(openid);
  }

  return {
    ...room,
    players: room.players.map((player) => (
      player.openid === openid ? { ...player, ready: Boolean(ready) } : player
    )),
    readyOpenids: Array.from(readyOpenids)
  };
}

function canDeal(room) {
  if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
    return false;
  }
  if (room.roundNumber === 0) {
    return true;
  }
  return room.players.every((player) => room.readyOpenids.includes(player.openid));
}

function createRoomView(room, openid, now) {
  const onlineSince = now - 2 * 60 * 1000;
  return {
    _id: `${room._id}_${openid}`,
    roomId: room._id,
    openid,
    roomCode: room.roomCode,
    ownerOpenid: room.ownerOpenid,
    status: room.status,
    roundNumber: room.roundNumber,
    remainingDeckCount: room.deckRemaining.length,
    players: room.players.map((player) => ({
      openid: player.openid,
      nickname: player.nickname,
      initial: player.nickname.slice(0, 1),
      avatarUrl: player.avatarUrl,
      isOwner: player.openid === room.ownerOpenid,
      ready: room.readyOpenids.includes(player.openid),
      online: player.lastSeenAt >= onlineSince,
      hasHand: player.joinedRound <= room.roundNumber,
      joinedRound: player.joinedRound
    })),
    canDeal: canDeal(room),
    waitingForNextRound: (
      room.status === 'playing' &&
      room.players.some((player) => (
        player.openid === openid && player.joinedRound > room.roundNumber
      ))
    ),
    updatedAt: now
  };
}

module.exports = {
  MIN_PLAYERS,
  MAX_PLAYERS,
  ROOM_TTL_MS,
  createRoomState,
  addPlayer,
  removePlayer,
  setPlayerReady,
  canDeal,
  createRoomView
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/domain.test.js`

Expected: PASS with 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/lib/domain.js tests/domain.test.js
git commit -m "feat: add room domain rules"
```

---

### Task 4: Add Repository Contract and In-Memory Test Double

**Files:**
- Create: `cloudfunctions/roomApi/lib/repository.js`
- Create: `tests/helpers/memory-repository.js`
- Test: `tests/repository.test.js`

**Interfaces:**
- Consumes: room objects created by `domain.js`.
- Produces: `createCloudRepository(): Repository`; `createMemoryRepository(): Repository`.

Repository interface:

```js
{
  createRoom(room): Promise<void>,
  getRoom(roomId): Promise<Room | null>,
  getRoomByCode(roomCode): Promise<Room | null>,
  listExpiredRooms(now): Promise<Room[]>,
  updateRoom(roomId, patch): Promise<void>,
  saveRoomView(view): Promise<void>,
  removeRoomView(roomId, openid): Promise<void>,
  listRoomViews(roomId): Promise<RoomView[]>,
  saveHand(hand): Promise<void>,
  getHand(roomId, roundNumber, openid): Promise<Hand | null>,
  runRoomTransaction(roomId, mutator): Promise<unknown>,
  removeRoomCascade(roomId): Promise<void>
}
```

- [ ] **Step 1: Write the failing repository tests**

Create `tests/repository.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('memory repository stores rooms, views, and hands', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({
    _id: 'room-1',
    roomCode: '123456',
    deckRemaining: [],
    players: []
  });
  await repository.saveRoomView({
    _id: 'room-1_owner',
    roomId: 'room-1',
    openid: 'owner'
  });
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    roundNumber: 1,
    openid: 'owner',
    slots: []
  });

  assert.equal((await repository.getRoomByCode('123456'))._id, 'room-1');
  assert.equal((await repository.listRoomViews('room-1')).length, 1);
  assert.equal(
    (await repository.getHand('room-1', 1, 'owner')).openid,
    'owner'
  );
});

test('room transaction commits all writes when the mutator resolves', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({
    _id: 'room-1',
    roomCode: '123456',
    deckRemaining: [],
    players: []
  });

  await repository.runRoomTransaction('room-1', async (tx) => {
    const room = await tx.getRoom();
    await tx.updateRoom({ ...room, status: 'playing' });
    await tx.saveHand({
      _id: 'room-1_1_owner',
      roomId: 'room-1',
      roundNumber: 1,
      openid: 'owner',
      slots: []
    });
  });

  assert.equal((await repository.getRoom('room-1')).status, 'playing');
  assert.equal(
    (await repository.getHand('room-1', 1, 'owner')).openid,
    'owner'
  );
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/repository.test.js`

Expected: FAIL with `Cannot find module './helpers/memory-repository'`.

- [ ] **Step 3: Implement the repository contract and memory repository**

Create `cloudfunctions/roomApi/lib/repository.js`:

```js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function docId(roomId, openid, roundNumber) {
  return roundNumber === undefined
    ? `${roomId}_${openid}`
    : `${roomId}_${roundNumber}_${openid}`;
}

function withoutId(value) {
  const { _id, ...data } = value;
  return data;
}

async function getOne(collectionName, predicate) {
  const result = await db.collection(collectionName).where(predicate).limit(1).get();
  return result.data[0] || null;
}

function createCloudRepository() {
  return {
    async createRoom(room) {
      await db.collection('rooms').doc(room._id).set({ data: withoutId(room) });
    },

    async getRoom(roomId) {
      try {
        const result = await db.collection('rooms').doc(roomId).get();
        return result.data || null;
      } catch (error) {
        if (error.errCode === -1 || /not exist/i.test(error.message || '')) {
          return null;
        }
        throw error;
      }
    },

    getRoomByCode(roomCode) {
      return getOne('rooms', { roomCode });
    },

    async listExpiredRooms(now) {
      const command = db.command;
      const result = await db.collection('rooms')
        .where({ expiresAt: command.lt(now) })
        .get();
      return result.data;
    },

    async updateRoom(roomId, patch) {
      await db.collection('rooms').doc(roomId).update({ data: patch });
    },

    async saveRoomView(view) {
      await db.collection('room_views').doc(view._id).set({ data: withoutId(view) });
    },

    async removeRoomView(roomId, openid) {
      await db.collection('room_views').doc(docId(roomId, openid)).remove();
    },

    async listRoomViews(roomId) {
      const result = await db.collection('room_views').where({ roomId }).get();
      return result.data;
    },

    async saveHand(hand) {
      await db.collection('hands').doc(hand._id).set({ data: withoutId(hand) });
    },

    getHand(roomId, roundNumber, openid) {
      return getOne('hands', { roomId, roundNumber, openid });
    },

    async runRoomTransaction(roomId, mutator) {
      return db.runTransaction(async (transaction) => {
        const tx = {
          async getRoom() {
            const result = await transaction.collection('rooms').doc(roomId).get();
            return result.data || null;
          },
          async updateRoom(patch) {
            await transaction.collection('rooms').doc(roomId).update({ data: patch });
          },
          async saveRoomView(view) {
            await transaction.collection('room_views')
              .doc(view._id)
              .set({ data: withoutId(view) });
          },
          async saveHand(hand) {
            await transaction.collection('hands')
              .doc(hand._id)
              .set({ data: withoutId(hand) });
          }
        };

        return mutator(tx);
      });
    },

    async removeRoomCascade(roomId) {
      await db.collection('rooms').doc(roomId).remove();
      const collections = ['room_views', 'hands'];
      for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName).where({ roomId }).get();
        await Promise.all(snapshot.data.map((item) => (
          db.collection(collectionName).doc(item._id).remove()
        )));
      }
    }
  };
}

module.exports = {
  createCloudRepository,
  docId
};
```

Create `tests/helpers/memory-repository.js`:

```js
function clone(value) {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value));
}

function createMemoryRepository() {
  const rooms = new Map();
  const views = new Map();
  const hands = new Map();

  return {
    async createRoom(room) {
      rooms.set(room._id, clone(room));
    },

    async getRoom(roomId) {
      return clone(rooms.get(roomId) || null);
    },

    async getRoomByCode(roomCode) {
      const room = Array.from(rooms.values()).find((item) => item.roomCode === roomCode);
      return clone(room || null);
    },

    async listExpiredRooms(now) {
      return Array.from(rooms.values())
        .filter((room) => room.expiresAt < now)
        .map(clone);
    },

    async updateRoom(roomId, patch) {
      const current = rooms.get(roomId);
      if (!current) {
        const error = new Error('ROOM_NOT_FOUND');
        error.code = 'ROOM_NOT_FOUND';
        throw error;
      }
      rooms.set(roomId, { ...current, ...clone(patch) });
    },

    async saveRoomView(view) {
      views.set(view._id, clone(view));
    },

    async removeRoomView(roomId, openid) {
      views.delete(`${roomId}_${openid}`);
    },

    async listRoomViews(roomId) {
      return Array.from(views.values())
        .filter((view) => view.roomId === roomId)
        .map(clone);
    },

    async saveHand(hand) {
      hands.set(hand._id, clone(hand));
    },

    async getHand(roomId, roundNumber, openid) {
      const key = `${roomId}_${roundNumber}_${openid}`;
      return clone(hands.get(key) || null);
    },

    async runRoomTransaction(roomId, mutator) {
      const roomSnapshot = clone(rooms);
      const viewSnapshot = clone(Array.from(views.entries()));
      const handSnapshot = clone(Array.from(hands.entries()));

      const tx = {
        async getRoom() {
          return clone(rooms.get(roomId) || null);
        },
        async updateRoom(patch) {
          const current = rooms.get(roomId);
          rooms.set(roomId, { ...current, ...clone(patch) });
        },
        async saveRoomView(view) {
          views.set(view._id, clone(view));
        },
        async saveHand(hand) {
          hands.set(hand._id, clone(hand));
        }
      };

      try {
        return await mutator(tx);
      } catch (error) {
        rooms.clear();
        roomSnapshot.forEach((value, key) => rooms.set(key, value));
        views.clear();
        viewSnapshot.forEach(([key, value]) => views.set(key, value));
        hands.clear();
        handSnapshot.forEach(([key, value]) => hands.set(key, value));
        throw error;
      }
    },

    async removeRoomCascade(roomId) {
      rooms.delete(roomId);
      for (const [key, value] of views.entries()) {
        if (value.roomId === roomId) views.delete(key);
      }
      for (const [key, value] of hands.entries()) {
        if (value.roomId === roomId) hands.delete(key);
      }
    }
  };
}

module.exports = { createMemoryRepository };
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/repository.test.js`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/lib/repository.js tests/helpers/memory-repository.js tests/repository.test.js
git commit -m "feat: add cloud and memory repositories"
```

---

### Task 5: Add Public Errors and Room View Projection

**Files:**
- Create: `cloudfunctions/roomApi/lib/errors.js`
- Create: `cloudfunctions/roomApi/lib/room-view.js`
- Test: `tests/room-view.test.js`

**Interfaces:**
- Consumes: `createRoomView(room, openid, now)` from `domain.js`; `Repository` from `repository.js`.
- Produces: `AppError`; `toPublicError(error)`; `toRoomPatch(room)`; `syncRoomViews(repository, room, now): Promise<void>`; `syncRoomView(repository, room, openid, now): Promise<void>`.

- [ ] **Step 1: Write the failing projection tests**

Create `tests/room-view.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { AppError, toPublicError } = require('../cloudfunctions/roomApi/lib/errors');
const {
  toRoomPatch,
  syncRoomViews
} = require('../cloudfunctions/roomApi/lib/room-view');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('toPublicError hides internal messages while preserving app error codes', () => {
  const publicError = toPublicError(new AppError('ROOM_FULL', '房间已满'));
  assert.deepEqual(publicError, {
    ok: false,
    error: { code: 'ROOM_FULL', message: '房间已满' }
  });

  assert.deepEqual(toPublicError(new Error('secret stack')), {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '操作失败，请重试' }
  });
});

test('toRoomPatch removes immutable _id', () => {
  assert.deepEqual(toRoomPatch({ _id: 'room-1', status: 'playing' }), {
    status: 'playing'
  });
});

test('syncRoomViews writes one view for every current player', async () => {
  const repository = createMemoryRepository();
  const room = {
    _id: 'room-1',
    roomCode: '123456',
    ownerOpenid: 'a',
    status: 'waiting',
    players: [
      { openid: 'a', nickname: 'A', avatarUrl: '', joinedRound: 1, ready: false, lastSeenAt: 1000 },
      { openid: 'b', nickname: 'B', avatarUrl: '', joinedRound: 1, ready: false, lastSeenAt: 1000 }
    ],
    roundNumber: 0,
    deckRemaining: [],
    readyOpenids: []
  };

  await syncRoomViews(repository, room, 1000);
  const views = await repository.listRoomViews('room-1');
  assert.deepEqual(views.map((view) => view.openid).sort(), ['a', 'b']);
  assert.equal(views[0].players.length, 2);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/room-view.test.js`

Expected: FAIL with missing `errors.js` or `room-view.js`.

- [ ] **Step 3: Implement errors and projection helpers**

Create `cloudfunctions/roomApi/lib/errors.js`:

```js
class AppError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AppError';
    this.code = code;
  }
}

function toPublicError(error) {
  if (error instanceof AppError || error.code) {
    const code = error.code || 'INTERNAL_ERROR';
    const messages = {
      ROOM_NOT_FOUND: '房间不存在或已失效',
      ROOM_FULL: '房间已满',
      ALREADY_JOINED: '你已经在这个房间中',
      PLAYER_NOT_FOUND: '玩家不在房间中',
      NOT_ROOM_OWNER: '只有房主可以发牌',
      NOT_ENOUGH_PLAYERS: '至少需要 2 名玩家',
      NOT_ALL_READY: '需要所有玩家准备完成',
      STALE_DEAL_REQUEST: '房间状态已更新，请重新操作',
      HAND_NOT_FOUND: '当前轮次没有你的手牌',
      INVALID_HAND_LAYOUT: '摆牌数据无效',
      UNKNOWN_ACTION: '不支持的操作'
    };
    return {
      ok: false,
      error: {
        code,
        message: error.message && error.name === 'AppError'
          ? error.message
          : (messages[code] || '操作失败，请重试')
      }
    };
  }

  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '操作失败，请重试' }
  };
}

module.exports = { AppError, toPublicError };
```

Create `cloudfunctions/roomApi/lib/room-view.js`:

```js
const { createRoomView } = require('./domain');

function toRoomPatch(room) {
  const { _id, ...patch } = room;
  return patch;
}

async function syncRoomView(repository, room, openid, now) {
  await repository.saveRoomView(createRoomView(room, openid, now));
}

async function syncRoomViews(repository, room, now) {
  await Promise.all(
    room.players.map((player) => syncRoomView(repository, room, player.openid, now))
  );
}

module.exports = {
  toRoomPatch,
  syncRoomView,
  syncRoomViews
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/room-view.test.js`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/lib/errors.js cloudfunctions/roomApi/lib/room-view.js tests/room-view.test.js
git commit -m "feat: add room view projection"
```

---

### Task 6: Implement Create, Join, and Leave Handlers

**Files:**
- Create: `cloudfunctions/roomApi/handlers/create-room.js`
- Create: `cloudfunctions/roomApi/handlers/join-room.js`
- Create: `cloudfunctions/roomApi/handlers/leave-room.js`
- Test: `tests/create-join-leave.test.js`

**Interfaces:**
- Consumes: `createRoomState`, `addPlayer`, `removePlayer`, `syncRoomViews`, `toRoomPatch`.
- Produces: async handlers `createRoom(payload, context, deps)`, `joinRoom(payload, context, deps)`, `leaveRoom(payload, context, deps)`.
- `createRoom` returns `{ roomId, roomCode }`.
- `joinRoom` returns `{ roomId, roomCode }`.
- `leaveRoom` returns `{ roomId, left: true }`.

- [ ] **Step 1: Write the failing handler tests**

Create `tests/create-join-leave.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const leaveRoom = require('../cloudfunctions/roomApi/handlers/leave-room');

function deps(repository) {
  let nextId = 0;
  return {
    repository,
    now: () => 1000 + nextId,
    randomUUID: () => `room-${++nextId}`,
    randomInt: () => 123456,
    random: () => 0.5
  };
}

test('createRoom creates the owner view and returns a six-digit code', async () => {
  const repository = createMemoryRepository();
  const result = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    deps(repository)
  );

  assert.equal(result.roomCode, '123456');
  assert.equal((await repository.listRoomViews(result.roomId)).length, 1);
});

test('joinRoom rejects duplicate players and the fourteenth player', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );

  for (let index = 2; index <= 13; index += 1) {
    await joinRoom(
      { roomCode: room.roomCode, nickname: `玩家${index}`, avatarUrl: '' },
      { openid: `p-${index}` },
      dependency
    );
  }

  await assert.rejects(
    joinRoom(
      { roomCode: room.roomCode, nickname: '玩家14', avatarUrl: '' },
      { openid: 'p-14' },
      dependency
    ),
    /ROOM_FULL/
  );
  await assert.rejects(
    joinRoom(
      { roomCode: room.roomCode, nickname: '房主', avatarUrl: '' },
      { openid: 'owner' },
      dependency
    ),
    /ALREADY_JOINED/
  );
});

test('leaveRoom removes the player view and transfers ownership', async () => {
  const repository = createMemoryRepository();
  const dependency = deps(repository);
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    dependency
  );
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    dependency
  );

  await leaveRoom({ roomId: room.roomId }, { openid: 'owner' }, dependency);
  const stored = await repository.getRoom(room.roomId);
  assert.equal(stored.ownerOpenid, 'p-2');
  assert.deepEqual(
    (await repository.listRoomViews(room.roomId)).map((view) => view.openid),
    ['p-2']
  );
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/create-join-leave.test.js`

Expected: FAIL because the three handler modules do not exist.

- [ ] **Step 3: Implement the three handlers**

Create `cloudfunctions/roomApi/handlers/create-room.js`:

```js
const { randomInt } = require('node:crypto');
const { createRoomState } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { syncRoomViews } = require('../lib/room-view');

function defaultRoomCode(deps) {
  return String((deps.randomInt || randomInt)(100000, 1000000));
}

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function createRoom(payload, context, deps) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roomCode = defaultRoomCode(deps);
    if (await deps.repository.getRoomByCode(roomCode)) {
      continue;
    }

    const now = deps.now();
    const room = createRoomState({
      roomId: (deps.randomUUID || require('node:crypto').randomUUID)(),
      roomCode,
      owner: {
        openid: context.openid,
        nickname: payload.nickname || defaultNickname(context.openid),
        avatarUrl: payload.avatarUrl || ''
      },
      now
    });

    await deps.repository.createRoom(room);
    await syncRoomViews(deps.repository, room, now);
    return { roomId: room._id, roomCode: room.roomCode };
  }

  throw new AppError('ROOM_CODE_EXHAUSTED', '房间号生成失败，请重试');
};
```

Create `cloudfunctions/roomApi/handlers/join-room.js`:

```js
const { addPlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

function defaultNickname(openid) {
  return `玩家${String(openid).slice(-4).toUpperCase()}`;
}

module.exports = async function joinRoom(payload, context, deps) {
  const room = await deps.repository.getRoomByCode(String(payload.roomCode || ''));
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  const nextRoom = addPlayer(room, {
    openid: context.openid,
    nickname: payload.nickname || defaultNickname(context.openid),
    avatarUrl: payload.avatarUrl || ''
  }, now);

  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { roomId: room._id, roomCode: room.roomCode };
};
```

Create `cloudfunctions/roomApi/handlers/leave-room.js`:

```js
const { removePlayer } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function leaveRoom(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  if (!room.players.some((player) => player.openid === context.openid)) {
    throw new AppError('PLAYER_NOT_FOUND');
  }

  const now = deps.now();
  const nextRoom = {
    ...removePlayer(room, context.openid),
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  };
  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await deps.repository.removeRoomView(room._id, context.openid);
  await syncRoomViews(deps.repository, nextRoom, now);
  return { roomId: room._id, left: true };
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/create-join-leave.test.js`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/handlers/create-room.js cloudfunctions/roomApi/handlers/join-room.js cloudfunctions/roomApi/handlers/leave-room.js tests/create-join-leave.test.js
git commit -m "feat: add room membership handlers"
```

---

### Task 7: Implement Ready and Heartbeat Handlers

**Files:**
- Create: `cloudfunctions/roomApi/handlers/set-ready.js`
- Create: `cloudfunctions/roomApi/handlers/heartbeat.js`
- Test: `tests/ready-heartbeat.test.js`

**Interfaces:**
- Consumes: `setPlayerReady`, `syncRoomViews`, `toRoomPatch`.
- Produces: `setReady(payload, context, deps): Promise<{ ready: boolean }>`; `heartbeat(payload, context, deps): Promise<{ online: true, openid: string }>`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ready-heartbeat.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const setReady = require('../cloudfunctions/roomApi/handlers/set-ready');
const heartbeat = require('../cloudfunctions/roomApi/handlers/heartbeat');

async function setup() {
  const repository = createMemoryRepository();
  let tick = 0;
  const deps = {
    repository,
    now: () => 1000 + tick++,
    randomUUID: () => 'room-1',
    randomInt: () => 234567,
    random: () => 0.5
  };
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'owner' },
    deps
  );
  await joinRoom(
    { roomCode: room.roomCode, nickname: '玩家2', avatarUrl: '' },
    { openid: 'p-2' },
    deps
  );
  return { repository, deps, room };
}

test('setReady updates the room and every view', async () => {
  const { repository, deps, room } = await setup();
  const result = await setReady(
    { roomId: room.roomId, ready: true },
    { openid: 'owner' },
    deps
  );
  assert.equal(result.ready, true);

  const views = await repository.listRoomViews(room.roomId);
  const ownerView = views.find((view) => view.openid === 'owner');
  assert.equal(ownerView.players.find((player) => player.openid === 'owner').ready, true);
});

test('heartbeat updates lastSeenAt and keeps the room alive', async () => {
  const { repository, deps, room } = await setup();
  const before = await repository.getRoom(room.roomId);
  const result = await heartbeat({ roomId: room.roomId }, { openid: 'owner' }, deps);
  const after = await repository.getRoom(room.roomId);

  assert.equal(result.openid, 'owner');
  assert.equal(after.players.find((player) => player.openid === 'owner').lastSeenAt > 1000, true);
  assert.equal(after.expiresAt > before.expiresAt, true);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/ready-heartbeat.test.js`

Expected: FAIL because `set-ready.js` and `heartbeat.js` do not exist.

- [ ] **Step 3: Implement the handlers**

Create `cloudfunctions/roomApi/handlers/set-ready.js`:

```js
const { setPlayerReady } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function setReady(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');

  const now = deps.now();
  const nextRoom = setPlayerReady(room, context.openid, Boolean(payload.ready));
  await deps.repository.updateRoom(room._id, toRoomPatch({
    ...nextRoom,
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  }));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { ready: Boolean(payload.ready) };
};
```

Create `cloudfunctions/roomApi/handlers/heartbeat.js`:

```js
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function heartbeat(payload, context, deps) {
  const room = await deps.repository.getRoom(payload.roomId);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  if (!room.players.some((player) => player.openid === context.openid)) {
    throw new AppError('PLAYER_NOT_FOUND');
  }

  const now = deps.now();
  const nextRoom = {
    ...room,
    players: room.players.map((player) => (
      player.openid === context.openid
        ? { ...player, lastSeenAt: now }
        : player
    )),
    updatedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000
  };

  await deps.repository.updateRoom(room._id, toRoomPatch(nextRoom));
  await syncRoomViews(deps.repository, nextRoom, now);
  return { online: true, openid: context.openid };
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/ready-heartbeat.test.js`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/handlers/set-ready.js cloudfunctions/roomApi/handlers/heartbeat.js tests/ready-heartbeat.test.js
git commit -m "feat: add ready and heartbeat handlers"
```

---

### Task 8: Implement Authoritative Dealing

**Files:**
- Create: `cloudfunctions/roomApi/handlers/deal-round.js`
- Test: `tests/deal-round.test.js`

**Interfaces:**
- Consumes: `canDeal`, `drawRound`, `toRoomPatch`, `syncRoomViews`.
- Produces: `dealRound(payload, context, deps): Promise<{ roundNumber, reshuffled, remainingDeckCount, idempotent }>`.
- Payload: `{ roomId: string, expectedRoundNumber: number, requestId: string }`.

- [ ] **Step 1: Write the failing deal tests**

Create `tests/deal-round.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const createRoom = require('../cloudfunctions/roomApi/handlers/create-room');
const joinRoom = require('../cloudfunctions/roomApi/handlers/join-room');
const dealRound = require('../cloudfunctions/roomApi/handlers/deal-round');

async function setup(playerCount = 4) {
  const repository = createMemoryRepository();
  let tick = 0;
  const deps = {
    repository,
    now: () => 1000 + tick++,
    randomUUID: () => 'room-1',
    randomInt: () => 345678,
    random: () => 0.25
  };
  const room = await createRoom(
    { nickname: '房主', avatarUrl: '' },
    { openid: 'p-1' },
    deps
  );
  for (let index = 2; index <= playerCount; index += 1) {
    await joinRoom(
      { roomCode: room.roomCode, nickname: `玩家${index}`, avatarUrl: '' },
      { openid: `p-${index}` },
      deps
    );
  }
  return { repository, deps, room };
}

test('first deal gives every player four unique cards and uses the deck', async () => {
  const { repository, deps, room } = await setup(4);
  const result = await dealRound(
    { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' },
    { openid: 'p-1' },
    deps
  );

  assert.equal(result.roundNumber, 1);
  assert.equal(result.remainingDeckCount, 38);
  assert.equal(result.reshuffled, false);
  assert.equal((await repository.getHand(room.roomId, 1, 'p-1')).slots.length, 4);
  assert.equal((await repository.getHand(room.roomId, 1, 'p-4')).slots.length, 4);
});

test('the same deal request is idempotent', async () => {
  const { deps, room } = await setup(4);
  const payload = { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' };
  const first = await dealRound(payload, { openid: 'p-1' }, deps);
  const second = await dealRound(payload, { openid: 'p-1' }, deps);
  assert.equal(second.roundNumber, first.roundNumber);
  assert.equal(second.idempotent, true);
});

test('insufficient deck is reshuffled to 54 before dealing', async () => {
  const { repository, deps, room } = await setup(4);
  const stored = await repository.getRoom(room.roomId);
  await repository.updateRoom(room.roomId, {
    deckRemaining: stored.deckRemaining.slice(0, 6)
  });

  const result = await dealRound(
    { roomId: room.roomId, expectedRoundNumber: 0, requestId: 'deal-1' },
    { openid: 'p-1' },
    deps
  );
  assert.equal(result.reshuffled, true);
  assert.equal(result.remainingDeckCount, 38);
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/deal-round.test.js`

Expected: FAIL because `deal-round.js` does not exist.

- [ ] **Step 3: Implement the transaction-safe handler**

Create `cloudfunctions/roomApi/handlers/deal-round.js`:

```js
const { drawRound } = require('../lib/cards');
const { canDeal } = require('../lib/domain');
const { AppError } = require('../lib/errors');
const { toRoomPatch, syncRoomViews } = require('../lib/room-view');

module.exports = async function dealRound(payload, context, deps) {
  const roomBefore = await deps.repository.getRoom(payload.roomId);
  if (!roomBefore) throw new AppError('ROOM_NOT_FOUND');
  if (roomBefore.ownerOpenid !== context.openid) {
    throw new AppError('NOT_ROOM_OWNER');
  }
  if (roomBefore.players.length < 2) {
    throw new AppError('NOT_ENOUGH_PLAYERS');
  }

  let publicResult;

  await deps.repository.runRoomTransaction(payload.roomId, async (tx) => {
    const room = await tx.getRoom();
    if (room.lastDealRequestId === payload.requestId && room.lastDealResult) {
      publicResult = { ...room.lastDealResult, idempotent: true };
      return;
    }
    if (room.roundNumber !== payload.expectedRoundNumber) {
      throw new AppError('STALE_DEAL_REQUEST');
    }
    if (!canDeal(room)) {
      throw new AppError(room.players.length < 2 ? 'NOT_ENOUGH_PLAYERS' : 'NOT_ALL_READY');
    }

    const now = deps.now();
    const dealt = drawRound(room.deckRemaining, room.players.length, deps.random);
    const roundNumber = room.roundNumber + 1;
    const nextRoom = {
      ...room,
      status: 'playing',
      players: room.players.map((player) => ({ ...player, ready: false })),
      roundNumber,
      deckRemaining: dealt.remainingDeck,
      deckGeneration: room.deckGeneration + (dealt.reshuffled ? 1 : 0),
      readyOpenids: [],
      lastDealRequestId: payload.requestId,
      updatedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000
    };

    publicResult = {
      roundNumber,
      reshuffled: dealt.reshuffled,
      remainingDeckCount: dealt.remainingDeck.length,
      idempotent: false
    };
    nextRoom.lastDealResult = publicResult;

    await tx.updateRoom(toRoomPatch(nextRoom));
    for (let index = 0; index < room.players.length; index += 1) {
      const player = room.players[index];
      const cards = dealt.hands[index];
      await tx.saveHand({
        _id: `${room._id}_${roundNumber}_${player.openid}`,
        roomId: room._id,
        openid: player.openid,
        roundNumber,
        cards,
        slots: cards.map((card) => card.id),
        dealtAt: now,
        updatedAt: now
      });
      await tx.saveRoomView(require('../lib/domain').createRoomView(
        nextRoom,
        player.openid,
        now
      ));
    }
  });

  const finalRoom = await deps.repository.getRoom(payload.roomId);
  await syncRoomViews(deps.repository, finalRoom, deps.now());
  return publicResult;
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/deal-round.test.js`

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/handlers/deal-round.js tests/deal-round.test.js
git commit -m "feat: add authoritative deal handler"
```

---

### Task 9: Implement Hand Arrangement

**Files:**
- Create: `cloudfunctions/roomApi/handlers/arrange-hand.js`
- Test: `tests/arrange-hand.test.js`

**Interfaces:**
- Consumes: `Repository.getHand`, `Repository.saveHand`.
- Produces: `arrangeHand(payload, context, deps): Promise<{ slots: string[] }>`.
- Payload: `{ roomId: string, roundNumber: number, slots: string[] }`.

- [ ] **Step 1: Write the failing arrangement tests**

Create `tests/arrange-hand.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemoryRepository } = require('./helpers/memory-repository');
const arrangeHand = require('../cloudfunctions/roomApi/handlers/arrange-hand');

test('arrangeHand saves a permutation of the existing four cards', async () => {
  const repository = createMemoryRepository();
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    openid: 'owner',
    roundNumber: 1,
    cards: [
      { id: 'S-A' },
      { id: 'H-K' },
      { id: 'D-3' },
      { id: 'JOKER-BIG' }
    ],
    slots: ['S-A', 'H-K', 'D-3', 'JOKER-BIG']
  });

  const result = await arrangeHand({
    roomId: 'room-1',
    roundNumber: 1,
    slots: ['JOKER-BIG', 'D-3', 'H-K', 'S-A']
  }, { openid: 'owner' }, {
    repository,
    now: () => 2000
  });

  assert.deepEqual(result.slots, ['JOKER-BIG', 'D-3', 'H-K', 'S-A']);
});

test('arrangeHand rejects duplicated or substituted cards', async () => {
  const repository = createMemoryRepository();
  await repository.saveHand({
    _id: 'room-1_1_owner',
    roomId: 'room-1',
    openid: 'owner',
    roundNumber: 1,
    cards: [{ id: 'S-A' }, { id: 'H-K' }, { id: 'D-3' }, { id: 'JOKER-BIG' }],
    slots: ['S-A', 'H-K', 'D-3', 'JOKER-BIG']
  });

  await assert.rejects(
    arrangeHand({
      roomId: 'room-1',
      roundNumber: 1,
      slots: ['S-A', 'S-A', 'D-3', 'JOKER-BIG']
    }, { openid: 'owner' }, { repository, now: () => 2000 }),
    /INVALID_HAND_LAYOUT/
  );
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test tests/arrange-hand.test.js`

Expected: FAIL because `arrange-hand.js` does not exist.

- [ ] **Step 3: Implement the handler**

Create `cloudfunctions/roomApi/handlers/arrange-hand.js`:

```js
const { AppError } = require('../lib/errors');

function sameCardSet(left, right) {
  return left.slice().sort().join('|') === right.slice().sort().join('|');
}

module.exports = async function arrangeHand(payload, context, deps) {
  const hand = await deps.repository.getHand(
    payload.roomId,
    payload.roundNumber,
    context.openid
  );

  if (!hand) throw new AppError('HAND_NOT_FOUND');

  const slots = Array.isArray(payload.slots) ? payload.slots : [];
  const cardIds = hand.cards.map((card) => card.id);
  if (slots.length !== 4 || !sameCardSet(slots, cardIds)) {
    throw new AppError('INVALID_HAND_LAYOUT');
  }

  await deps.repository.saveHand({
    ...hand,
    slots,
    updatedAt: deps.now()
  });

  return { slots };
};
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/arrange-hand.test.js`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/handlers/arrange-hand.js tests/arrange-hand.test.js
git commit -m "feat: persist player hand arrangement"
```

---

### Task 10: Implement Expired Room Cleanup

**Files:**
- Create: `cloudfunctions/cleanupExpiredRooms/cleanup.js`
- Create: `cloudfunctions/cleanupExpiredRooms/repository.js`
- Create: `cloudfunctions/cleanupExpiredRooms/index.js`
- Create: `cloudfunctions/cleanupExpiredRooms/package.json`
- Test: `tests/cleanup.test.js`

**Interfaces:**
- Consumes: `Repository.listExpiredRooms(now)` and `Repository.removeRoomCascade(roomId)`.
- Produces: `runCleanup(repository, now): Promise<{ deletedRoomIds: string[] }>`; cloud function `main()`.

- [ ] **Step 1: Write the failing cleanup test**

Create `tests/cleanup.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { runCleanup } = require('../cloudfunctions/cleanupExpiredRooms/cleanup');
const { createMemoryRepository } = require('./helpers/memory-repository');

test('cleanup removes only expired rooms and their related documents', async () => {
  const repository = createMemoryRepository();
  await repository.createRoom({ _id: 'expired', roomCode: '111111', expiresAt: 100 });
  await repository.createRoom({ _id: 'active', roomCode: '222222', expiresAt: 300 });
  await repository.saveRoomView({ _id: 'expired_owner', roomId: 'expired', openid: 'owner' });
  await repository.saveHand({
    _id: 'expired_1_owner',
    roomId: 'expired',
    roundNumber: 1,
    openid: 'owner'
  });

  const result = await runCleanup(repository, 200);
  assert.deepEqual(result.deletedRoomIds, ['expired']);
  assert.equal(await repository.getRoom('expired'), null);
  assert.equal((await repository.getRoom('active'))._id, 'active');
  assert.equal((await repository.listRoomViews('expired')).length, 0);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/cleanup.test.js`

Expected: FAIL because `cleanup.js` does not exist.

- [ ] **Step 3: Implement the cleanup function**

Create `cloudfunctions/cleanupExpiredRooms/cleanup.js`:

```js
async function runCleanup(repository, now) {
  const expiredRooms = await repository.listExpiredRooms(now);
  const deletedRoomIds = [];

  for (const room of expiredRooms) {
    await repository.removeRoomCascade(room._id);
    deletedRoomIds.push(room._id);
  }

  return { deletedRoomIds };
}

module.exports = { runCleanup };
```

Create `cloudfunctions/cleanupExpiredRooms/index.js`:

```js
const cloud = require('wx-server-sdk');
const { runCleanup } = require('./cleanup');
const { createCleanupRepository } = require('./repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const result = await runCleanup(createCleanupRepository(), Date.now());
  console.log('cleanup result', result);
  return { ok: true, data: result };
};
```

Create `cloudfunctions/cleanupExpiredRooms/repository.js`:

```js
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function createCleanupRepository() {
  return {
    async listExpiredRooms(now) {
      const command = db.command;
      const result = await db.collection('rooms')
        .where({ expiresAt: command.lt(now) })
        .get();
      return result.data;
    },

    async removeRoomCascade(roomId) {
      await db.collection('rooms').doc(roomId).remove();
      for (const collectionName of ['room_views', 'hands']) {
        const snapshot = await db.collection(collectionName).where({ roomId }).get();
        await Promise.all(snapshot.data.map((item) => (
          db.collection(collectionName).doc(item._id).remove()
        )));
      }
    }
  };
}

module.exports = { createCleanupRepository };
```

Create `cloudfunctions/cleanupExpiredRooms/package.json`:

```json
{
  "name": "cleanup-expired-rooms",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test tests/cleanup.test.js`

Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/cleanupExpiredRooms tests/cleanup.test.js
git commit -m "feat: clean up expired rooms"
```

---

### Task 11: Wire the Room API Dispatcher

**Files:**
- Create: `cloudfunctions/roomApi/lib/dispatcher.js`
- Create: `cloudfunctions/roomApi/index.js`
- Create: `cloudfunctions/roomApi/package.json`
- Test: `tests/dispatcher.test.js`

**Interfaces:**
- Consumes: all seven room handlers from Tasks 6～9.
- Produces: `dispatch(event, context, deps): Promise<unknown>`; cloud function `main(event, context)` with `{ action, payload }`.

- [ ] **Step 1: Write the failing dispatcher test**

Create `tests/dispatcher.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { dispatch, createDispatcher } = require('../cloudfunctions/roomApi/lib/dispatcher');
const { AppError } = require('../cloudfunctions/roomApi/lib/errors');

test('dispatcher calls the requested action with context and dependencies', async () => {
  const seen = [];
  const run = createDispatcher({
    echo: async (payload, context, deps) => {
      seen.push({ payload, context, sameDeps: deps.token === 'deps' });
      return payload.value;
    }
  });

  const result = await run(
    { action: 'echo', payload: { value: 42 } },
    { openid: 'owner' },
    { token: 'deps' }
  );

  assert.equal(result, 42);
  assert.deepEqual(seen, [{
    payload: { value: 42 },
    context: { openid: 'owner' },
    sameDeps: true
  }]);
});

test('dispatcher rejects an unknown action as a public app error', async () => {
  await assert.rejects(
    dispatch(
      { action: 'missing', payload: {} },
      { openid: 'owner' },
      {}
    ),
    (error) => error instanceof AppError && error.code === 'UNKNOWN_ACTION'
  );
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/dispatcher.test.js`

Expected: FAIL because `dispatcher.js` does not exist.

- [ ] **Step 3: Implement dispatcher, function entry, and package metadata**

Create `cloudfunctions/roomApi/lib/dispatcher.js`:

```js
const { AppError } = require('./errors');
const createRoom = require('../handlers/create-room');
const joinRoom = require('../handlers/join-room');
const leaveRoom = require('../handlers/leave-room');
const setReady = require('../handlers/set-ready');
const heartbeat = require('../handlers/heartbeat');
const dealRound = require('../handlers/deal-round');
const arrangeHand = require('../handlers/arrange-hand');

const DEFAULT_HANDLERS = {
  createRoom,
  joinRoom,
  leaveRoom,
  setReady,
  heartbeat,
  dealRound,
  arrangeHand
};

function createDispatcher(handlers = DEFAULT_HANDLERS) {
  return async function run(event, context, deps) {
    const handler = handlers[event.action];
    if (!handler) throw new AppError('UNKNOWN_ACTION');
    return handler(event.payload || {}, context, deps);
  };
}

const dispatch = createDispatcher();

module.exports = { dispatch, createDispatcher };
```

Create `cloudfunctions/roomApi/index.js`:

```js
const cloud = require('wx-server-sdk');
const { randomInt, randomUUID } = require('node:crypto');
const { createCloudRepository } = require('./lib/repository');
const { dispatch } = require('./lib/dispatcher');
const { toPublicError } = require('./lib/errors');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function createDependencies() {
  return {
    repository: createCloudRepository(),
    now: () => Date.now(),
    randomUUID,
    randomInt,
    random: () => randomInt(0, 1_000_000) / 1_000_000
  };
}

exports.main = async (event) => {
  try {
    const context = cloud.getWXContext();
    const data = await dispatch(event, { openid: context.OPENID }, createDependencies());
    return { ok: true, data };
  } catch (error) {
    console.error(error);
    return toPublicError(error);
  }
};
```

Create `cloudfunctions/roomApi/package.json`:

```json
{
  "name": "room-api",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `node --test tests/dispatcher.test.js`

Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add cloudfunctions/roomApi/lib/dispatcher.js cloudfunctions/roomApi/index.js cloudfunctions/roomApi/package.json tests/dispatcher.test.js
git commit -m "feat: expose room api dispatcher"
```

---

### Task 12: Add Client Cloud Services and Pure Utilities

**Files:**
- Create: `miniprogram/services/cloud.js`
- Create: `miniprogram/services/room-api.js`
- Create: `miniprogram/services/session.js`
- Create: `miniprogram/services/watchers.js`
- Create: `miniprogram/utils/validation.js`
- Create: `miniprogram/utils/card-layout.js`
- Test: `tests/validation.test.js`
- Test: `tests/card-layout.test.js`

**Interfaces:**
- Produces: `normalizeRoomCode(value): string`; `validateRoomCode(value): boolean`; `newRequestId(): string`.
- Produces: `swapSlots(slots, fromIndex, toIndex): string[]`; `findDropIndex(rects, point): number`.
- Produces: `callRoomApi(action, payload): Promise<unknown>`; room API methods `createRoom`, `joinRoom`, `leaveRoom`, `setReady`, `heartbeat`, `dealRound`, `arrangeHand`.
- Produces: `getActiveRoom(): { roomId, roomCode } | null`; `setActiveRoom(room): void`; `clearActiveRoom(): void`.
- Produces: `watchRoomView(roomId, openid, onChange, onError): { close(): void }` and `watchHand(roomId, roundNumber, openid, onChange, onError): { close(): void }`.

- [ ] **Step 1: Write the failing pure utility tests**

Create `tests/validation.test.js`:

```js
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
```

Create `tests/card-layout.test.js`:

```js
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
```

- [ ] **Step 2: Run the utility tests and verify they fail**

Run: `node --test tests/validation.test.js tests/card-layout.test.js`

Expected: FAIL because the utility modules do not exist.

- [ ] **Step 3: Implement services and utilities**

Create `miniprogram/utils/validation.js`:

```js
function normalizeRoomCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function validateRoomCode(value) {
  return /^\d{6}$/.test(normalizeRoomCode(value));
}

function newRequestId() {
  return `deal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { normalizeRoomCode, validateRoomCode, newRequestId };
```

Create `miniprogram/utils/card-layout.js`:

```js
function swapSlots(slots, fromIndex, toIndex) {
  const result = slots.slice();
  [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
  return result;
}

function findDropIndex(rects, point) {
  return rects.findIndex((rect) => (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  ));
}

module.exports = { swapSlots, findDropIndex };
```

Create `miniprogram/services/cloud.js`:

```js
function callRoomApi(action, payload = {}) {
  return wx.cloud.callFunction({
    name: 'roomApi',
    data: { action, payload }
  }).then(({ result }) => {
    if (!result || result.ok !== true) {
      const error = new Error(result && result.error && result.error.message);
      error.code = result && result.error && result.error.code;
      throw error;
    }
    return result.data;
  });
}

module.exports = { callRoomApi };
```

Create `miniprogram/services/room-api.js`:

```js
const { callRoomApi } = require('./cloud');

module.exports = {
  createRoom(profile) {
    return callRoomApi('createRoom', profile);
  },
  joinRoom(payload) {
    return callRoomApi('joinRoom', payload);
  },
  leaveRoom(roomId) {
    return callRoomApi('leaveRoom', { roomId });
  },
  setReady(roomId, ready) {
    return callRoomApi('setReady', { roomId, ready });
  },
  heartbeat(roomId) {
    return callRoomApi('heartbeat', { roomId });
  },
  dealRound(payload) {
    return callRoomApi('dealRound', payload);
  },
  arrangeHand(payload) {
    return callRoomApi('arrangeHand', payload);
  }
};
```

Create `miniprogram/services/session.js`:

```js
const ACTIVE_ROOM_KEY = 'activeRoom';

function getActiveRoom() {
  return wx.getStorageSync(ACTIVE_ROOM_KEY) || null;
}

function setActiveRoom(room) {
  wx.setStorageSync(ACTIVE_ROOM_KEY, {
    roomId: room.roomId,
    roomCode: room.roomCode
  });
}

function clearActiveRoom() {
  wx.removeStorageSync(ACTIVE_ROOM_KEY);
}

module.exports = { getActiveRoom, setActiveRoom, clearActiveRoom };
```

Create `miniprogram/services/watchers.js`:

```js
function watchRoomView(roomId, openid, onChange, onError) {
  return wx.cloud.database()
    .collection('room_views')
    .where({ _id: `${roomId}_${openid}` })
    .watch({
      onChange(snapshot) {
        if (snapshot.docs && snapshot.docs[0]) onChange(snapshot.docs[0]);
      },
      onError
    });
}

function watchHand(roomId, roundNumber, openid, onChange, onError) {
  return wx.cloud.database()
    .collection('hands')
    .where({ _id: `${roomId}_${roundNumber}_${openid}` })
    .watch({
      onChange(snapshot) {
        if (snapshot.docs && snapshot.docs[0]) onChange(snapshot.docs[0]);
      },
      onError
    });
}

module.exports = { watchRoomView, watchHand };
```

- [ ] **Step 4: Run the utility tests and verify they pass**

Run: `node --test tests/validation.test.js tests/card-layout.test.js`

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/services miniprogram/utils tests/validation.test.js tests/card-layout.test.js
git commit -m "feat: add client cloud services"
```

---

### Task 13: Build the Home Page

**Files:**
- Create: `miniprogram/pages/index/index.js`
- Create: `miniprogram/pages/index/index.json`
- Create: `miniprogram/pages/index/index.wxml`
- Create: `miniprogram/pages/index/index.wxss`
- Test: `tests/page-contract.test.js`

**Interfaces:**
- Consumes: `roomApi.createRoom(profile)`, `roomApi.joinRoom(payload)`, `normalizeRoomCode`, `validateRoomCode`.
- Produces: home page routes to `pages/room/room?roomId=...`; stores `activeRoomId` and `activeRoomCode` in `app.globalData`.

- [ ] **Step 1: Write the failing page contract test**

Create `tests/page-contract.test.js`:

```js
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
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test tests/page-contract.test.js`

Expected: FAIL because the page templates do not exist.

- [ ] **Step 3: Implement the home page**

Create `miniprogram/pages/index/index.json`:

```json
{
  "navigationBarTitleText": "广西水鱼"
}
```

Create `miniprogram/pages/index/index.wxml`:

```xml
<view class="page-shell home">
  <view class="home-header">
    <view class="brand-mark">水鱼</view>
    <view class="home-title">广西水鱼扑克牌</view>
    <view class="home-subtitle">建房间、发四张、线下比大小</view>
  </view>

  <view class="home-actions">
    <button
      wx:if="{{activeRoom}}"
      class="secondary-button"
      bindtap="onContinueRoom"
    >
      返回房间 {{activeRoom.roomCode}}
    </button>

    <button class="primary-button" loading="{{loading}}" bindtap="onCreateRoom">
      创建房间
    </button>

    <view class="join-panel">
      <input
        class="room-code-input"
        type="number"
        maxlength="6"
        placeholder="输入 6 位房间号"
        value="{{roomCode}}"
        bindinput="onRoomCodeInput"
      />
      <button
        class="secondary-button"
        loading="{{loading}}"
        disabled="{{roomCode.length !== 6}}"
        bindtap="onJoinRoom"
      >
        加入房间
      </button>
    </view>
  </view>
</view>
```

Create `miniprogram/pages/index/index.js`:

```js
const app = getApp();
const roomApi = require('../../services/room-api');
const { getActiveRoom, clearActiveRoom } = require('../../services/session');
const {
  getActiveRoom,
  setActiveRoom
} = require('../../services/session');
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
```

Create `miniprogram/pages/index/index.wxss`:

```css
.home {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 80rpx;
}

.home-header {
  text-align: center;
}

.brand-mark {
  width: 160rpx;
  height: 160rpx;
  margin: 0 auto 32rpx;
  border-radius: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f5132;
  color: #ffffff;
  font-size: 44rpx;
  font-weight: 700;
  box-shadow: 0 20rpx 44rpx rgba(15, 81, 50, 0.22);
}

.home-title {
  font-size: 52rpx;
  font-weight: 700;
}

.home-subtitle {
  margin-top: 16rpx;
  color: #66756d;
  font-size: 28rpx;
}

.home-actions {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.join-panel {
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 32rpx rgba(24, 37, 31, 0.08);
}

.room-code-input {
  height: 90rpx;
  margin-bottom: 24rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  border: 2rpx solid #d8ded9;
  border-radius: 14rpx;
  font-size: 38rpx;
  letter-spacing: 8rpx;
  text-align: center;
}
```

- [ ] **Step 4: Run the smoke and page tests**

Run: `node --test --test-name-pattern="home page" tests/page-contract.test.js`

Expected: the `home page` contract test passes; the other page contract tests are skipped by the name filter.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/index tests/page-contract.test.js
git commit -m "feat: add home page"
```

---

### Task 14: Build the Room Page and Realtime Player List

**Files:**
- Create: `miniprogram/pages/room/room.js`
- Create: `miniprogram/pages/room/room.json`
- Create: `miniprogram/pages/room/room.wxml`
- Create: `miniprogram/pages/room/room.wxss`

**Interfaces:**
- Consumes: `roomApi` methods from Task 12; `watchRoomView`; `newRequestId`.
- Produces: room page navigates to `pages/table/table?roomId=...` after a deal; shares `pages/index/index?roomCode=...`; leaves through `leaveRoom`.

- [ ] **Step 1: Confirm the page contract is failing**

Run: `node --test tests/page-contract.test.js`

Expected: FAIL with `miniprogram/pages/room/room.wxml`.

- [ ] **Step 2: Create the room page markup**

Create `miniprogram/pages/room/room.json`:

```json
{
  "navigationBarTitleText": "房间"
}
```

Create `miniprogram/pages/room/room.wxml`:

```xml
<view class="page-shell room-page">
  <view class="room-code-card">
    <view class="room-code-label">房间号</view>
    <view class="room-code-value">{{room.roomCode}}</view>
    <view class="room-code-hint">人数 {{room.players.length}} / 13</view>
  </view>

  <view class="section-title">玩家</view>
  <view class="player-grid">
    <view
      class="player-card"
      wx:for="{{room.players}}"
      wx:key="openid"
    >
      <image
        wx:if="{{item.avatarUrl}}"
        class="player-avatar"
        src="{{item.avatarUrl}}"
        mode="aspectFill"
      />
      <view wx:else class="player-avatar player-avatar-text">
        {{item.initial}}
      </view>
      <view class="player-name">{{item.nickname}}</view>
      <view class="player-tags">
        <text wx:if="{{item.isOwner}}" class="tag owner-tag">房主</text>
        <text class="tag {{item.ready ? 'ready-tag' : ''}}">
          {{item.ready ? '已准备' : (item.hasHand ? '已发牌' : '未准备')}}
        </text>
      </view>
    </view>
  </view>

  <view class="room-actions">
    <button
      wx:if="{{isOwner}}"
      class="primary-button"
      loading="{{dealing}}"
      disabled="{{!room.canDeal || dealing}}"
      bindtap="onStartDeal"
    >
      {{room.roundNumber === 0 ? '开始发牌' : '重新发牌'}}
    </button>

    <button class="secondary-button" open-type="share">分享房间</button>
    <button class="text-button" bindtap="onLeaveRoom">退出房间</button>
  </view>
</view>
```

Create `miniprogram/pages/room/room.wxss`:

```css
.room-page {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.room-code-card {
  padding: 40rpx;
  border-radius: 20rpx;
  background: #0f5132;
  color: #ffffff;
  text-align: center;
}

.room-code-label,
.room-code-hint {
  color: rgba(255, 255, 255, 0.72);
  font-size: 26rpx;
}

.room-code-value {
  margin: 12rpx 0;
  font-size: 64rpx;
  font-weight: 700;
  letter-spacing: 8rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
}

.player-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.player-card {
  min-height: 190rpx;
  padding: 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.player-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #e5ebe6;
}

.player-avatar-text {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0f5132;
  font-size: 30rpx;
  font-weight: 700;
}

.player-name {
  margin-top: 14rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 30rpx;
  font-weight: 600;
}

.player-tags {
  display: flex;
  gap: 10rpx;
  margin-top: 12rpx;
}

.tag {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: #eef1ef;
  color: #66756d;
  font-size: 22rpx;
}

.owner-tag {
  background: #d8eadf;
  color: #0f5132;
}

.ready-tag {
  background: #d8eadf;
  color: #0f5132;
}

.room-actions {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.text-button {
  background: transparent;
  color: #66756d;
  font-size: 30rpx;
}
```

- [ ] **Step 3: Implement room state and watchers**

Create `miniprogram/pages/room/room.js`:

```js
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
      clearActiveRoom();
      app.globalData.activeRoomId = '';
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
```

- [ ] **Step 4: Run the page contract test**

Run: `node --test --test-name-pattern="room page" tests/page-contract.test.js`

Expected: the `room page` contract test passes.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/room
git commit -m "feat: add room page"
```

---

### Task 15: Build the 2×2 Table Page with Drag-to-Swap

**Files:**
- Create: `miniprogram/pages/table/table.js`
- Create: `miniprogram/pages/table/table.json`
- Create: `miniprogram/pages/table/table.wxml`
- Create: `miniprogram/pages/table/table.wxss`

**Interfaces:**
- Consumes: `roomApi.heartbeat`, `roomApi.setReady`, `roomApi.arrangeHand`; `watchRoomView`; `watchHand`; `swapSlots`; `findDropIndex`.
- Produces: a page with exactly four fixed slots, touch dragging, swap persistence, and the next-round ready control.

- [ ] **Step 1: Confirm the page contract is failing**

Run: `node --test --test-name-pattern="table page" tests/page-contract.test.js`

Expected: FAIL with `miniprogram/pages/table/table.wxml`.

- [ ] **Step 2: Create the table markup**

Create `miniprogram/pages/table/table.json`:

```json
{
  "navigationBarTitleText": "牌桌"
}
```

Create `miniprogram/pages/table/table.wxml`:

```xml
<view class="page-shell table-page">
  <view class="table-status">
    <view>
      <view class="status-label">第 {{room.roundNumber}} 轮</view>
      <view class="status-value">剩余底牌 {{room.remainingDeckCount}} 张</view>
    </view>
    <view class="status-label">
      {{waitingForNextRound ? '等待下一局' : (hasHand ? '已发牌' : '等待发牌')}}
    </view>
  </view>

  <view class="table-board" wx:if="{{hasHand}}">
    <view
      class="card-slot {{draggingIndex === index ? 'dragging' : ''}} {{dropIndex === index ? 'drop-target' : ''}}"
      wx:for="{{slots}}"
      wx:key="id"
      data-index="{{index}}"
      bindtouchstart="onTouchStart"
      bindtouchmove="onTouchMove"
      bindtouchend="onTouchEnd"
      bindtouchcancel="onTouchEnd"
    >
      <view class="playing-card {{item.isRed ? 'red-card' : ''}}">
        <view class="card-rank">{{item.rank}}</view>
        <view class="card-suit">{{item.suitText}}</view>
      </view>
    </view>
  </view>

  <view class="table-empty" wx:else>
    <view class="empty-title">等待下一局</view>
    <view class="muted">房主发牌后，这里会出现你的四张牌。</view>
  </view>

  <view class="player-strip">
    <view class="strip-player" wx:for="{{room.players}}" wx:key="openid">
      <view class="strip-name">{{item.nickname}}</view>
      <view class="strip-state">
        {{item.ready ? '已准备' : (item.hasHand ? '已发牌' : '等待')}}
      </view>
    </view>
  </view>

  <view class="ready-bar" wx:if="{{hasHand || waitingForNextRound}}">
    <button
      class="{{ownReady ? 'secondary-button' : 'primary-button'}}"
      disabled="{{savingReady}}"
      bindtap="onToggleReady"
    >
      {{ownReady ? '取消准备' : '下一局准备'}}
    </button>
    <button
      wx:if="{{isOwner && room.canDeal}}"
      class="primary-button"
      loading="{{dealing}}"
      disabled="{{dealing}}"
      bindtap="onStartNextDeal"
    >
      发下一轮
    </button>
  </view>
</view>
```

Create `miniprogram/pages/table/table.wxss`:

```css
.table-page {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.table-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx;
  border-radius: 16rpx;
  background: #0f5132;
  color: #ffffff;
}

.status-label {
  color: rgba(255, 255, 255, 0.72);
  font-size: 25rpx;
}

.status-value {
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 600;
}

.table-board {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, 1fr);
  gap: 24rpx;
  min-height: 720rpx;
}

.card-slot {
  min-width: 0;
  min-height: 330rpx;
  padding: 20rpx;
  border: 3rpx dashed rgba(15, 81, 50, 0.24);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
}

.card-slot.dragging {
  transform: scale(0.96);
  opacity: 0.68;
}

.card-slot.drop-target {
  border-color: #0f5132;
  background: #e2eee6;
}

.playing-card {
  width: 100%;
  height: 100%;
  min-height: 280rpx;
  border-radius: 16rpx;
  background: #ffffff;
  color: #18251f;
  box-shadow: 0 10rpx 24rpx rgba(24, 37, 31, 0.14);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 22rpx;
  box-sizing: border-box;
}

.red-card {
  color: #b42318;
}

.card-rank {
  font-size: 72rpx;
  line-height: 1;
  font-weight: 700;
}

.card-suit {
  align-self: flex-end;
  font-size: 68rpx;
  line-height: 1;
}

.table-empty {
  min-height: 720rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border: 3rpx dashed #cbd4ce;
  border-radius: 20rpx;
}

.empty-title {
  font-size: 36rpx;
  font-weight: 700;
}

.player-strip {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 8rpx;
}

.strip-player {
  flex: 0 0 180rpx;
  padding: 18rpx;
  border-radius: 14rpx;
  background: #ffffff;
}

.strip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 28rpx;
  font-weight: 600;
}

.strip-state {
  margin-top: 8rpx;
  color: #66756d;
  font-size: 23rpx;
}

.ready-bar {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
```

- [ ] **Step 3: Implement table state, watchers, and dragging**

Create `miniprogram/pages/table/table.js`:

```js
const app = getApp();
const roomApi = require('../../services/room-api');
const {
  watchRoomView,
  watchHand
} = require('../../services/watchers');
const {
  swapSlots,
  findDropIndex
} = require('../../utils/card-layout');
const { newRequestId } = require('../../utils/validation');

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
    } catch (error) {
      clearActiveRoom();
      showError(error);
    }
  },

  onReady() {
    this.measureSlots();
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
    });
    this.measureSlots();
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
    if (this.data.draggingIndex < 0 || !this.slotRects) return;
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

  onUnload() {
    if (this.roomWatcher) this.roomWatcher.close();
    if (this.handWatcher) this.handWatcher.close();
  }
});
```

- [ ] **Step 4: Run the page and utility tests**

Run: `node --test tests/page-contract.test.js tests/card-layout.test.js`

Expected: PASS with 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add miniprogram/pages/table
git commit -m "feat: add draggable table page"
```

---

### Task 16: Configure CloudBase Security, Indexes, and Deployment Docs

**Files:**
- Create: `docs/cloudbase-setup.md`
- Create: `docs/manual-test.md`
- Create: `README.md`

**Interfaces:**
- Consumes: cloud functions and collections created in Tasks 1～15.
- Produces: exact setup instructions for the WeChat CloudBase console, security rules, indexes, scheduled cleanup, and device tests.

- [ ] **Step 1: Write the CloudBase setup and verification guide**

Create `docs/cloudbase-setup.md`:

```markdown
# WeChat CloudBase Setup

## 1. Create the environment

1. Open the project in WeChat DevTools with the user's Mini Program AppID.
2. Open Cloud Development and create one environment.
3. If more than one environment exists, select the environment used by this project in DevTools.
4. Right-click `cloudfunctions/roomApi`, choose upload and deploy with cloud dependency installation.
5. Right-click `cloudfunctions/cleanupExpiredRooms`, choose upload and deploy with cloud dependency installation.

## 2. Create collections

Create these collections:

- `rooms`
- `room_views`
- `hands`

Do not create seed documents. Cloud functions create all documents.

## 3. Set collection permissions

Use custom security rules in the CloudBase console.

`rooms`:

```json
{
  "read": false,
  "write": false
}
```

`room_views`:

```json
{
  "read": "doc.openid == auth.openid",
  "write": false
}
```

`hands`:

```json
{
  "read": "doc.openid == auth.openid",
  "write": false
}
```

Cloud functions run with admin permission and continue to write all documents.

## 4. Create indexes

Create these indexes:

- `rooms.roomCode`: unique ascending index.
- `rooms.expiresAt`: ascending index.
- `room_views.roomId + room_views.openid`: unique composite index.
- `hands.roomId + hands.roundNumber + hands.openid`: unique composite index.

## 5. Schedule cleanup

Add a timer trigger to `cleanupExpiredRooms`:

```text
0 0 * * * * *
```

The expression runs the cleanup once per hour.

## 6. Deploy verification

After deployment, run the `createRoom` action from DevTools Cloud Function testing:

```json
{
  "action": "createRoom",
  "payload": {
    "nickname": "测试房主",
    "avatarUrl": ""
  }
}
```

Expected result:

```json
{
  "ok": true,
  "data": {
    "roomId": "<generated>",
    "roomCode": "<six digits>"
  }
}
```
```

Create `docs/manual-test.md`:

```markdown
# Manual Device Test

## Preparation

- Use two WeChat accounts on two phones for the core flow.
- Use at least one additional test account or DevTools for a three-player check.
- Select the correct CloudBase environment in WeChat DevTools.
- Deploy both cloud functions before testing.

## Core flow

1. Phone A creates a room.
2. Phone A shares the room card to Phone B.
3. Phone B opens the card, joins, and sees both players.
4. Phone A taps 开始发牌.
5. Both phones receive exactly four cards.
6. Phone A cannot see Phone B's card faces.
7. Phone B drags its top-left card to the bottom-right slot.
8. The two cards swap immediately.
9. Phone B closes and reopens the Mini Program and confirms the same arrangement.
10. Both players tap 下一局准备.
11. Phone A's 重新发牌 button becomes available.
12. Phone A deals again and the remaining deck count decreases by 8 for two players.

## Deck exhaustion

1. Use four players.
2. Deal rounds until the remaining count reaches 6.
3. Start the next round.
4. Confirm the system reshuffles and the remaining count becomes 38.

## Capacity and privacy

1. Fill a room with 13 test players.
2. Confirm the 14th player is rejected.
3. From one account, query another account's `hands` document in the console as that user.
4. Confirm the read is denied.

## Recovery

1. Put Phone B in the background during a round.
2. Bring it back within 2 minutes.
3. Confirm the room state and hand return without creating a second seat.
```

Create `README.md`:

```markdown
# 广西水鱼扑克牌微信小程序

一个只负责建房、发牌和摆牌的微信小程序。每名玩家私密获得四张牌，在自己手机的 2×2 牌槽中拖动换位，线下自行比大小。

## Local checks

```bash
npm test
```

## Cloud deployment

See `docs/cloudbase-setup.md`.

## Device verification

See `docs/manual-test.md`.

## Design and plan

- `docs/superpowers/specs/2026-10-09-shuiyu-poker-mini-program-design.md`
- `docs/superpowers/plans/2026-10-09-shuiyu-poker-mini-program.md`
```

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Expected: all test files pass; no test performs a network request or reads a real cloud environment.

- [ ] **Step 3: Run the device checklist**

Run the complete checklist in `docs/manual-test.md` with two phones.

Expected:

- Room creation and joining work.
- Four private cards appear on each device.
- Drag swaps persist.
- All-ready gating works.
- Two-player deck remaining counts decrease by 8 per round.
- A four-player forced six-card deck resets to 54 before dealing.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/cloudbase-setup.md docs/manual-test.md
git commit -m "docs: add deployment and verification guide"
```
