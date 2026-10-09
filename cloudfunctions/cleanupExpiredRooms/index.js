const cloud = require('wx-server-sdk');
const { runCleanup } = require('./cleanup');
const { createCleanupRepository } = require('./repository');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const result = await runCleanup(createCleanupRepository(), Date.now());
  console.log('cleanup result', result);
  return { ok: true, data: result };
};
