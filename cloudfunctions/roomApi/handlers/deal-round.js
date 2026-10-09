const { drawRound } = require('../lib/cards');
const { canDeal, createRoomView } = require('../lib/domain');
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
      await tx.saveRoomView(createRoomView(nextRoom, player.openid, now));
    }
  });

  const finalRoom = await deps.repository.getRoom(payload.roomId);
  await syncRoomViews(deps.repository, finalRoom, deps.now());
  return publicResult;
};
