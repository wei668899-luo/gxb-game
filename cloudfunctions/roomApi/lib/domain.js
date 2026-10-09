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
