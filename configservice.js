async function getLastSyncTimestamp(_merchantId, _feedId) {
  return new Date().toISOString()
}

async function updateLastSyncTimestamp(_merchantId, _feedId, _ts) {
  return
}

async function getFeedsByWebhookTopic(_merchantId, _topic) {
  return []
}

module.exports = {
  getLastSyncTimestamp,
  updateLastSyncTimestamp,
  getFeedsByWebhookTopic,
}
