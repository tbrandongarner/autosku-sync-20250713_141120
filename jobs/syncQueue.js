function enqueueSyncTaskFromWebhook(payload) {
  console.log('enqueue task', payload)
  return Promise.resolve()
}
module.exports = { enqueueSyncTaskFromWebhook }
