const express = require('express')
const { Shopify, ApiVersion } = require('@shopify/shopify-api')
const { OAuth2Client } = require('google-auth-library')
const crypto = require('crypto')
const db = require('../db')
require('dotenv').config()

const HOST = process.env.HOST
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET
const STATE_SECRET = process.env.STATE_SECRET
const rawScopes = process.env.SHOPIFY_SCOPES
if (!STATE_SECRET) throw new Error('Missing STATE_SECRET environment variable')
if (!rawScopes) throw new Error('Missing SHOPIFY_SCOPES environment variable')
const SCOPES = rawScopes.split(',').map(s => s.trim()).filter(Boolean)
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || ApiVersion.October23
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
]

function signState(payload) {
  const data = JSON.stringify({ ...payload, ts: Date.now() })
  const b64 = Buffer.from(data).toString('base64url')
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('hex')
  return `${b64}.${sig}`
}

function verifyState(state) {
  const parts = state.split('.')
  if (parts.length !== 2) throw new Error('Invalid state format')
  const [b64, sig] = parts
  const expectedSig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('hex')
  const sigBuf = Buffer.from(sig, 'hex')
  const expBuf = Buffer.from(expectedSig, 'hex')
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid state signature')
  }
  const json = Buffer.from(b64, 'base64url').toString('utf8')
  return JSON.parse(json)
}

Shopify.Context.initialize({
  API_KEY: SHOPIFY_API_KEY,
  API_SECRET_KEY: SHOPIFY_API_SECRET,
  SCOPES,
  HOST_NAME: HOST.replace(/https?:\/\//, ''),
  API_VERSION: SHOPIFY_API_VERSION,
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.CustomSessionStorage(
    async (id) => {
      const result = await db.query('SELECT * FROM merchants WHERE shopify_session_id = $1', [id])
      if (!result.rows.length) return null
      const row = result.rows[0]
      return new Shopify.Session.Session({
        id: row.shopify_session_id,
        shop: row.shop,
        state: row.state,
        isOnline: row.is_online,
        scope: row.scope,
        accessToken: row.access_token,
        expires: row.expires_at ? new Date(row.expires_at) : undefined
      })
    },
    async (session) => {
      const exists = await db.query('SELECT id FROM merchants WHERE shopify_session_id = $1', [session.id])
      if (exists.rows.length) {
        await db.query(
          `UPDATE merchants SET access_token=$1, scope=$2, expires_at=$3, updated_at=NOW() WHERE shopify_session_id=$4`,
          [session.accessToken, session.scope, session.expires, session.id]
        )
      } else {
        await db.query(
          `INSERT INTO merchants (shop, shopify_session_id, access_token, scope, expires_at, is_online, state, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [session.shop, session.id, session.accessToken, session.scope, session.expires, session.isOnline, session.state]
        )
      }
    },
    async (id) => {
      await db.query('DELETE FROM merchants WHERE shopify_session_id = $1', [id])
    }
  )
})

function initAuthRoutes(app) {
  const router = express.Router()
  router.get('/auth/shopify', startShopifyOAuth)
  router.get('/auth/shopify/callback', handleShopifyCallback)
  router.get('/auth/google', startGoogleOAuth)
  router.get('/auth/google/callback', handleGoogleCallback)
  app.use(router)
}

async function startShopifyOAuth(req, res) {
  try {
    const shop = req.query.shop
    if (!shop) return res.status(400).send('Missing shop parameter')
    const redirectUrl = await Shopify.Auth.beginAuth(req, res, shop, '/auth/shopify/callback', false)
    res.redirect(redirectUrl)
  } catch (error) {
    console.error('Error in startShopifyOAuth', error)
    res.status(500).send('OAuth initiation failed')
  }
}

async function handleShopifyCallback(req, res) {
  try {
    const session = await Shopify.Auth.validateAuthCallback(req, res, req.query)
    const host = req.query.host
    res.redirect(`/?shop=${session.shop}&host=${host}`)
  } catch (error) {
    console.error('Error in handleShopifyCallback', error)
    res.status(500).send('OAuth callback failed')
  }
}

async function startGoogleOAuth(req, res) {
  try {
    const shop = req.query.shop
    const host = req.query.host
    if (!shop || !host) return res.status(400).send('Missing shop or host')
    const result = await db.query('SELECT id FROM merchants WHERE shop = $1', [shop])
    if (!result.rows.length) return res.status(404).send('Merchant not found')
    const merchantId = result.rows[0].id
    const state = signState({ merchantId, shop, host })
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${HOST}/auth/google/callback`
    )
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
      state
    })
    res.redirect(authUrl)
  } catch (error) {
    console.error('Error in startGoogleOAuth', error)
    res.status(500).send('Google OAuth initiation failed')
  }
}

async function handleGoogleCallback(req, res) {
  try {
    const code = req.query.code
    const rawState = req.query.state
    if (!code || !rawState) return res.status(400).send('Missing code or state')
    let payload
    try {
      payload = verifyState(rawState)
    } catch {
      return res.status(400).send('Invalid state parameter')
    }
    const { merchantId, shop, host } = payload
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${HOST}/auth/google/callback`
    )
    const { tokens } = await oauth2Client.getToken(code)
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null
    await db.query(
      `UPDATE merchants SET google_access_token=$1, google_refresh_token=$2, google_token_expiry_date=$3, updated_at=NOW() WHERE id=$4`,
      [tokens.access_token, tokens.refresh_token, expiryDate, merchantId]
    )
    res.redirect(`/?shop=${shop}&host=${host}`)
  } catch (error) {
    console.error('Error in handleGoogleCallback', error)
    res.status(500).send('Google OAuth callback failed')
  }
}

async function refreshAccessToken(merchantId) {
  const result = await db.query(
    `SELECT google_refresh_token FROM merchants WHERE id=$1`,
    [merchantId]
  )
  if (!result.rows.length) throw new Error('Merchant not found')
  const refreshToken = result.rows[0].google_refresh_token
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${HOST}/auth/google/callback`
  )
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const refreshResponse = await oauth2Client.refreshToken(refreshToken)
  const tokens = refreshResponse.tokens
  const accessToken = tokens.access_token
  const newRefreshToken = tokens.refresh_token || refreshToken
  const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date) : null
  await db.query(
    `UPDATE merchants SET google_access_token=$1, google_refresh_token=$2, google_token_expiry_date=$3, updated_at=NOW() WHERE id=$4`,
    [accessToken, newRefreshToken, expiryDate, merchantId]
  )
  return tokens
}

async function getSession(req) {
  const shop = req.query.shop || req.body.shop
  if (!shop) return null
  const result = await db.query(
    `SELECT * FROM merchants WHERE shop = $1`,
    [shop]
  )
  if (!result.rows.length) return null
  const row = result.rows[0]
  return new Shopify.Session.Session({
    id: row.shopify_session_id,
    shop: row.shop,
    state: row.state,
    isOnline: row.is_online,
    scope: row.scope,
    accessToken: row.access_token,
    expires: row.expires_at ? new Date(row.expires_at) : undefined
  })
}

module.exports = {
  initAuthRoutes,
  startShopifyOAuth,
  handleShopifyCallback,
  startGoogleOAuth,
  handleGoogleCallback,
  refreshAccessToken,
  getSession
}