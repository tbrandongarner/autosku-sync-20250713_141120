const redisConnection = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD,
}

const syncQueue = new Queue('syncQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
})

new QueueScheduler('syncQueue', { connection: redisConnection })

const syncWorker = new Worker(
  'syncQueue',
  async job => {
    await handleScheduledJob(job)
  },
  { connection: redisConnection }
)

syncWorker.on('completed', job => {
  console.log(`Sync job ${job.id} completed for merchant ${job.data.merchantId}`)
})

syncWorker.on('failed', (job, err) => {
  console.error(`Sync job ${job.id} failed for merchant ${job.data.merchantId}:`, err)
})

export function scheduleSync(jobConfig) {
  const options = {
    removeOnComplete: true,
    removeOnFail: true,
  }
  if (jobConfig.scheduleCron) {
    options.repeat = { cron: jobConfig.scheduleCron }
  }
  const jobId = jobConfig.id || `${jobConfig.merchantId}-${Date.now()}`
  return syncQueue.add(jobId, jobConfig, options)
}

export async function startBulkImport(merchantId, feedConfig) {
  const records = await FeedService.fetchFullData(merchantId, feedConfig)
  if (!records || records.length === 0) {
    console.log(`No records found for bulk import: merchant=${merchantId}, feed=${feedConfig.id}`)
    return
  }
  await ShopifyService.bulkUpsertProducts(merchantId, records, feedConfig.mappings)
  console.log(`Bulk import completed: merchant=${merchantId}, feed=${feedConfig.id}`)
}

export async function startDeltaSync(merchantId, feedConfig) {
  const lastSync = await ConfigService.getLastSyncTimestamp(merchantId, feedConfig.id)
  const delta = await FeedService.fetchDeltaData(merchantId, feedConfig, lastSync)
  if (!delta || delta.length === 0) {
    console.log(`No delta changes for merchant=${merchantId}, feed=${feedConfig.id}`)
    return
  }
  await ShopifyService.bulkUpsertProducts(merchantId, delta, feedConfig.mappings)
  await ConfigService.updateLastSyncTimestamp(merchantId, feedConfig.id, new Date().toISOString())
  console.log(`Delta sync completed: merchant=${merchantId}, feed=${feedConfig.id}`)
}

export async function handleScheduledJob(job) {
  const { merchantId, feedConfig, syncMode } = job.data
  if (syncMode !== 'bulk' && syncMode !== 'delta') {
    throw new Error(`Unsupported syncMode "${syncMode}" for merchant=${merchantId}, feed=${feedConfig.id}`)
  }
  try {
    if (syncMode === 'bulk') {
      await startBulkImport(merchantId, feedConfig)
    } else {
      await startDeltaSync(merchantId, feedConfig)
    }
  } catch (err) {
    console.error(
      `Error processing scheduled job for merchant=${merchantId}, feed=${feedConfig.id}:`,
      err
    )
    throw err
  }
}

export async function handleWebhookTrigger(webhookPayload) {
  const merchantId = webhookPayload.shopId || webhookPayload.merchantId
  const topic = webhookPayload.topic || webhookPayload.type
  if (!merchantId || !topic) {
    throw new Error('Invalid webhook payload, missing merchantId or topic')
  }
  const feedConfigs = await ConfigService.getFeedsByWebhookTopic(merchantId, topic)
  const tasks = feedConfigs.map(feedConfig =>
    enqueueSyncTask({ merchantId, feedConfig, syncMode: 'delta' })
  )
  await Promise.all(tasks)
}

export function enqueueSyncTask(task) {
  const jobId = `immediate-${task.merchantId}-${task.feedConfig.id}-${Date.now()}`
  return syncQueue.add(
    jobId,
    task,
    {
      removeOnComplete: true,
      removeOnFail: true,
    }
  )
}