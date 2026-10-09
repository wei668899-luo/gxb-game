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
