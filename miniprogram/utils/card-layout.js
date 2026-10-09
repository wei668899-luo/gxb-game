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
