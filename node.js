const express = require('express')
const crypto = require('crypto')
const bodyParser = require('body-parser')
require('dotenv').config()

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET
if (!SHOPIFY_WEBHOOK_SECRET) {
  console.error('Missing required environment variable SHOPIFY_WEBHOOK_SECRET')
  process.exit(1)
}

const app = express()
const PORT = process.env.PORT || 3000

function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256')
  if (!hmacHeader) {
    return res.status(400).send('Missing Shopify signature header')
  }
  const computedHmac = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(req.body, 'utf8')
    .digest('base64')
  const signatureBuffer = Buffer.from(hmacHeader, 'utf8')
  const computedBuffer = Buffer.from(computedHmac, 'utf8')
  const valid =
    signatureBuffer.length === computedBuffer.length &&
    crypto.timingSafeEqual(signatureBuffer, computedBuffer)
  if (!valid) {
    return res.status(401).send('Invalid Shopify signature')
  }
  next()
}

app.post(
  '/webhooks/product-update',
  bodyParser.raw({
    type: req => req.is('application/json'),
    limit: '1mb'
  }),
  verifyShopifyWebhook,
  (req, res) => {
    try {
      const payload = JSON.parse(req.body.toString('utf8'))
      console.log('Received Shopify webhook:', payload)
      res.status(200).send('Webhook processed')
    } catch (error) {
      console.error('Error parsing webhook payload:', error)
      res.status(400).send('Invalid payload')
    }
  }
)

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err)
  res.status(500).send('Internal Server Error')
})

app.listen(PORT, () => {
  console.log(`Shopify webhook listener running on port ${PORT}`)
})