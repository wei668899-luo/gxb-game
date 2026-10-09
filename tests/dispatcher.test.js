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
