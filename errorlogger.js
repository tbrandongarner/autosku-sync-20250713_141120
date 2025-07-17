const pino = require('pino')
const { PrismaClient } = require('@prisma/client')

let prisma
if (global.prismaClientInstance) {
  prisma = global.prismaClientInstance
} else {
  prisma = new PrismaClient()
  global.prismaClientInstance = prisma
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  base: { pid: false }
})

function categorizeError(error) {
  const name = error.name || ''
  if (name.includes('Validation')) return 'Validation'

  if (error.isAxiosError) {
    if (error.response) {
      const status = error.response.status
      if (status >= 400 && status < 500) return 'APIClient'
      if (status >= 500) return 'APIServer'
      return 'API'
    }
    if (error.code) return 'APINetwork'
    return 'API'
  }

  if (error.response && error.response.status) {
    const status = error.response.status
    if (status >= 400 && status < 500) return 'APIClient'
    if (status >= 500) return 'APIServer'
    return 'API'
  }

  if (error.statusCode) {
    if (error.statusCode >= 400 && error.statusCode < 500) return 'HTTPClient'
    if (error.statusCode >= 500) return 'HTTPServer'
  }

  if (error.code) return 'System'
  return 'Unknown'
}

async function persistErrorRecord({ message, stack, category, context }) {
  try {
    return await prisma.errorLog.create({
      data: {
        message,
        stack,
        category,
        context
      }
    })
  } catch (dbErr) {
    logger.error({ err: dbErr }, 'Failed to persist error record')
    throw dbErr
  }
}

async function logError(error, context = {}) {
  const category = categorizeError(error)
  const message = error.message || String(error)
  const stack = error.stack || null

  logger.error({ category, message, context, stack }, 'Captured error')

  try {
    await persistErrorRecord({ message, stack, category, context })
  } catch (err) {
    logger.error({ err }, 'Error in logError persistence')
  }
}

async function getErrorStats(filter = {}) {
  const where = {}
  if (filter.startDate || filter.endDate) {
    where.timestamp = {}
    if (filter.startDate) where.timestamp.gte = filter.startDate
    if (filter.endDate) where.timestamp.lte = filter.endDate
  }
  if (filter.category) {
    where.category = filter.category
  }

  try {
    const grouped = await prisma.errorLog.groupBy({
      by: ['category'],
      _count: { _all: true },
      where
    })
    return grouped.map(g => ({ category: g.category, count: g._count._all }))
  } catch (err) {
    logger.error({ err }, 'Failed to get error stats')
    throw err
  }
}

async function clearOldErrors(thresholdDate) {
  try {
    const result = await prisma.errorLog.deleteMany({
      where: {
        timestamp: { lt: thresholdDate }
      }
    })
    return result.count
  } catch (err) {
    logger.error({ err }, 'Failed to clear old errors')
    throw err
  }
}

module.exports = {
  logError,
  categorizeError,
  persistErrorRecord,
  getErrorStats,
  clearOldErrors
}