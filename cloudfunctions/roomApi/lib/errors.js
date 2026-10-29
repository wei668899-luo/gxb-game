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
        message: error instanceof AppError && error.message !== code
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
