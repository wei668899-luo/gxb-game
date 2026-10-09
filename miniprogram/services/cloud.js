function callRoomApi(action, payload = {}) {
  return wx.cloud.callFunction({
    name: 'roomApi',
    data: { action, payload }
  }).then(({ result }) => {
    if (!result || result.ok !== true) {
      const error = new Error(result && result.error && result.error.message);
      error.code = result && result.error && result.error.code;
      throw error;
    }
    return result.data;
  });
}

module.exports = { callRoomApi };
