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
