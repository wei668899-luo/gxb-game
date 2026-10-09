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
