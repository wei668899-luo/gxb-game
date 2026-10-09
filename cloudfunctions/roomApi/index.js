const cloud = require('wx-server-sdk');
const { randomInt, randomUUID } = require('node:crypto');
const { createCloudRepository } = require('./lib/repository');
const { dispatch } = require('./lib/dispatcher');
const { toPublicError } = require('./lib/errors');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

function createDependencies() {
  return {
    repository: createCloudRepository(),
    now: () => Date.now(),
    randomUUID,
    randomInt,
    random: () => randomInt(0, 1_000_000) / 1_000_000
  };
}

exports.main = async (event) => {
  try {
    const context = cloud.getWXContext();
    const data = await dispatch(event, { openid: context.OPENID }, createDependencies());
    return { ok: true, data };
  } catch (error) {
    console.error(error);
    return toPublicError(error);
  }
};
