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
