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
