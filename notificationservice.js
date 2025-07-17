const nodemailer = require('nodemailer')
const Joi = require('joi')
const sanitizeHtml = require('sanitize-html')
const db = require('../db')
const eventBus = require('../eventBus')

const MAX_HISTORY_LIMIT = 100
const DEFAULT_HISTORY_LIMIT = 50

function getCurrentTime() {
  return new Date()
}

const notificationSchema = Joi.object({
  merchantId: Joi.string().required(),
  message: Joi.string().required()
})

const emailSchema = Joi.object({
  email: Joi.string().email().required(),
  subject: Joi.string().required(),
  body: Joi.string().required()
})

const prefsSchema = Joi.object({
  email: Joi.boolean().default(false),
  inApp: Joi.boolean().default(false)
})
  .or('email', 'inApp')
  .required()

const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

async function sendInAppNotification(merchantId, message) {
  const { error } = notificationSchema.validate({ merchantId, message })
  if (error) {
    throw new Error(`Invalid parameters: ${error.message}`)
  }

  const sanitizedMessage = sanitizeHtml(message, {
    allowedTags: [],
    allowedAttributes: {}
  })

  const timestamp = getCurrentTime()
  const record = await db.notifications.create({
    data: {
      merchantId,
      message: sanitizedMessage,
      read: false,
      createdAt: timestamp
    }
  })

  eventBus.emit(`notification:${merchantId}`, {
    id: record.id,
    message: record.message,
    createdAt: record.createdAt
  })

  return record
}

async function sendEmailNotification(email, subject, body) {
  const { error } = emailSchema.validate({ email, subject, body })
  if (error) {
    throw new Error(`Invalid email parameters: ${error.message}`)
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject,
    text: body
  }

  const info = await emailTransporter.sendMail(mailOptions)
  await db.emailLogs.create({
    data: {
      to: email,
      subject,
      body,
      messageId: info.messageId,
      sentAt: getCurrentTime()
    }
  })
  return info
}

async function configureNotificationPreferences(merchantId, prefs) {
  const { error, value } = prefsSchema.validate(prefs)
  if (error) {
    throw new Error(`Invalid preference format: ${error.message}`)
  }
  const timestamp = getCurrentTime()
  const record = await db.notificationPreferences.upsert({
    where: { merchantId },
    update: {
      email: value.email,
      inApp: value.inApp,
      updatedAt: timestamp
    },
    create: {
      merchantId,
      email: value.email,
      inApp: value.inApp,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  })
  return record
}

async function getNotificationHistory(merchantId, options = {}) {
  if (!merchantId || typeof merchantId !== 'string') {
    throw new Error('Invalid merchantId')
  }

  let limit = DEFAULT_HISTORY_LIMIT
  let skip = 0

  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new Error('Limit must be a positive integer')
    }
    if (options.limit > MAX_HISTORY_LIMIT) {
      throw new Error(`Limit cannot exceed ${MAX_HISTORY_LIMIT}`)
    }
    limit = options.limit
  }

  if (options.skip !== undefined) {
    if (!Number.isInteger(options.skip) || options.skip < 0) {
      throw new Error('Skip must be a non-negative integer')
    }
    skip = options.skip
  }

  const records = await db.notifications.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
  return records
}

module.exports = {
  sendInAppNotification,
  sendEmailNotification,
  configureNotificationPreferences,
  getNotificationHistory
}