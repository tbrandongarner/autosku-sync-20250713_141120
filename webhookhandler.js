const crypto = require('crypto')
const getRawBody = require('raw-body')
const { enqueueSyncTaskFromWebhook } = require('../jobs/syncQueue')

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET
if (!SHOPIFY_WEBHOOK_SECRET) {
  throw new Error('Missing SHOPIFY_WEBHOOK_SECRET environment variable')
}

async function handleWebhook(req, res) {
  let rawBody
  try {
    rawBody = await getRawBody(req, {
      length: req.headers['content-length'],
      limit: '1mb',
      encoding: false,
    })
  } catch (err) {
    console.error('Failed to read raw body', err)
    return res.status(400).send('Invalid body')
  }

  const hmacHeader = req.headers['x-shopify-hmac-sha256']
  if (!hmacHeader) {
    return res.status(400).send('Missing HMAC header')
  }

  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64')

  let headerBuffer
  try {
    headerBuffer = Buffer.from(hmacHeader, 'base64')
  } catch (err) {
    console.error('Invalid HMAC header encoding', err)
    return res.status(400).send('Invalid HMAC header')
  }
  const hashBuffer = Buffer.from(generatedHash, 'base64')

  if (headerBuffer.length !== hashBuffer.length || !crypto.timingSafeEqual(headerBuffer, hashBuffer)) {
    return res.status(401).send('Unauthorized')
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch (err) {
    console.error('Failed to parse JSON', err)
    return res.status(400).send('Invalid JSON')
  }

  const topic = req.headers['x-shopify-topic']
  const shop = req.headers['x-shopify-shop-domain']

  res.status(200).send('OK')

  enqueueSyncTaskFromWebhook({ shop, topic, payload }).catch(err => {
    console.error('Failed to enqueue sync task', err)
  })
}

module.exports = handleWebhook