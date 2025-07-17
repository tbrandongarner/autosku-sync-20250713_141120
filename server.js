const express = require('express')
const session = require('express-session')
const { Shopify, ApiVersion } = require('@shopify/shopify-api')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const multer = require('multer')
const helmet = require('helmet')
const morgan = require('morgan')
require('dotenv').config()

// Initialize Shopify Context
Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: (process.env.SCOPES || '').split(','),
  HOST_NAME: process.env.HOST.replace(/https?:\/\//, ''),
  API_VERSION: ApiVersion.October23,
  IS_EMBEDDED_APP: true,
  SESSION_STORAGE: new Shopify.Session.MemorySessionStorage(),
})

const ACTIVE_SHOPIFY_SHOPS = {}

function initServer() {
  const app = express()
  return app
}

function registerMiddleware(app) {
  app.use(helmet())
  app.use(morgan('tiny'))
  app.use(cookieParser(process.env.COOKIE_SECRET))
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === 'production', sameSite: 'lax' },
    })
  )
  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ extended: true }))
  // serve React build
  app.use(express.static('public'))
}

function registerRoutes(app) {
  // Health check
  app.get('/health', (_req, res) => res.status(200).send('OK'))

  // Shopify Auth
  app.get('/auth', async (req, res) => {
    const shop = req.query.shop
    if (!shop) return res.status(400).send('Missing shop parameter.')
    const authRoute = await Shopify.Auth.beginAuth(
      req,
      res,
      shop,
      '/auth/callback',
      false
    )
    return res.redirect(authRoute)
  })

  app.get('/auth/callback', async (req, res) => {
    try {
      const session = await Shopify.Auth.validateAuthCallback(
        req,
        res,
        req.query
      )
      ACTIVE_SHOPIFY_SHOPS[session.shop] = session.scope
      // Register webhooks after auth
      const webhookRegistration = await Shopify.Webhooks.Registry.register({
        shop: session.shop,
        accessToken: session.accessToken,
        path: '/webhooks',
        topic: 'APP_UNINSTALLED',
      })
      if (!webhookRegistration.success) {
        console.warn(
          `Failed to register APP_UNINSTALLED webhook: ${webhookRegistration.result}`
        )
      }
      const redirectUrl = `/?shop=${session.shop}&host=${req.query.host}`
      res.redirect(redirectUrl)
    } catch (error) {
      console.error(error)
      res.status(500).send('Auth callback error')
    }
  })

  // Webhooks
  app.post(
    '/webhooks',
    bodyParser.raw({ type: 'application/json' }),
    async (req, res) => {
      try {
        const success = await Shopify.Webhooks.Registry.process(req, res)
        if (!success) {
          console.log('Could not process webhook')
          res.status(500).send('Error processing webhook')
        }
      } catch (err) {
        console.error(`Webhook Error: ${err.message}`)
        res.status(500).send(err.message)
      }
    }
  )

  // Verify auth for all /api routes
  app.use('/api', async (req, res, next) => {
    try {
      await Shopify.Auth.validateAuthenticatedFetch(
        req,
        res,
        async () => {
          next()
        }
      )
    } catch (err) {
      console.error(err)
      res.status(401).send('Unauthorized')
    }
  })

  // File upload setup
  const upload = multer({ dest: 'uploads/' })

  // CSV Upload route
  app.post('/api/upload-csv', upload.single('file'), async (req, res) => {
    try {
      // placeholder: parse CSV, map fields, enqueue job
      res.status(200).json({ success: true, message: 'CSV received' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // Google Sheets sync route
  app.post('/api/google-sync', async (req, res) => {
    try {
      const { sheetId, range, mappings } = req.body
      // placeholder: enqueue Google Sheets sync job
      res
        .status(200)
        .json({ success: true, message: 'Google Sheets sync started' })
    } catch (err) {
      console.error(err)
      res.status(500).json({ success: false, error: err.message })
    }
  })

  // Sample product fetch route
  app.get('/api/products', async (req, res) => {
    try {
      const session = await Shopify.Utils.loadCurrentSession(req, res, true)
      const client = new Shopify.Clients.Rest(session.shop, session.accessToken)
      const products = await client.get({ path: 'products', query: { limit: 10 } })
      res.status(200).json(products.body.products)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: err.message })
    }
  })

  // Fallback to index.html for all other routes (React Router)
  app.use('/*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' })
  })
}

function startServer(app, port) {
  app.listen(port, () => {
    console.log(`> Server is running on http://localhost:${port}`)
  })
}

// Main
const PORT = parseInt(process.env.PORT, 10) || 3000
const app = initServer()
registerMiddleware(app)
registerRoutes(app)
startServer(app, PORT)