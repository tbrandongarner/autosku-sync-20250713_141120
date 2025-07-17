const PLANS = {
  basic: { pricePerUnit: 0.01, cappedAmount: 1000, currency: 'USD' },
  pro: { pricePerUnit: 0.005, cappedAmount: 10000, currency: 'USD' },
  enterprise: { pricePerUnit: 0.002, cappedAmount: 100000, currency: 'USD' },
}

async function getSessionAndClient(merchantId) {
  const session = await db.getShopifySession(merchantId)
  if (!session) throw new Error('Shopify session not found')
  const client = new Shopify.Clients.Rest(session.shop, session.accessToken)
  return { session, client }
}

async function createCharge(merchantId, planId) {
  try {
    const { client } = await getSessionAndClient(merchantId)
    const plan = PLANS[planId]
    if (!plan) throw new Error(`Plan ${planId} not found`)
    const chargePayload = {
      recurring_application_charge: {
        name: `AutoSKU Sync (${planId})`,
        price: 0,
        capped_amount: plan.cappedAmount,
        terms: `Usage billing at $${plan.pricePerUnit}/${plan.currency}`,
        test: process.env.NODE_ENV !== 'production'
      }
    }
    const response = await client.post({
      path: 'recurring_application_charges',
      data: chargePayload,
      type: 'application/json'
    })
    const charge = response.body.recurring_application_charge
    await db.saveCharge(merchantId, {
      chargeId: charge.id,
      planId,
      status: charge.status,
      createdAt: new Date()
    })
    return charge.confirmation_url
  } catch (err) {
    errorlogger.logError({ merchantId, service: 'billing', action: 'createCharge', error: err })
    throw err
  }
}

async function getCurrentPlan(merchantId) {
  try {
    const { client } = await getSessionAndClient(merchantId)
    const record = await db.getCharge(merchantId)
    if (!record) return null
    const response = await client.get({
      path: `recurring_application_charges/${record.chargeId}`
    })
    const charge = response.body.recurring_application_charge
    if (charge.status === 'active') {
      return {
        planId: record.planId,
        status: charge.status,
        activatedOn: charge.activated_on,
        billingOn: charge.billing_on,
        trialDays: charge.trial_days,
        trialEndsOn: charge.trial_ends_on
      }
    }
    return null
  } catch (err) {
    errorlogger.logError({ merchantId, service: 'billing', action: 'getCurrentPlan', error: err })
    throw err
  }
}

async function getPlanLimits(planId) {
  const plan = PLANS[planId]
  if (!plan) throw new Error(`Plan ${planId} not found`)
  return {
    pricePerUnit: plan.pricePerUnit,
    cappedAmount: plan.cappedAmount,
    currency: plan.currency
  }
}

async function trackUsage(merchantId, usageRecord) {
  try {
    if (!Number.isInteger(usageRecord.quantity) || usageRecord.quantity <= 0) {
      throw new Error('Invalid usage quantity')
    }
    const current = await getCurrentPlan(merchantId)
    if (!current) throw new Error('No active subscription')
    const plan = PLANS[current.planId]
    const chargeRecord = await db.getCharge(merchantId)
    const { client } = await getSessionAndClient(merchantId)
    const totalCharge = usageRecord.quantity * plan.pricePerUnit
    const response = await client.post({
      path: `recurring_application_charges/${chargeRecord.chargeId}/usage_charges`,
      data: {
        usage_charge: {
          description: usageRecord.description,
          price: totalCharge
        }
      },
      type: 'application/json'
    })
    const usage = response.body.usage_charge
    await db.saveUsage(merchantId, {
      quantity: usageRecord.quantity,
      description: usageRecord.description,
      price: usage.price,
      createdAt: new Date()
    })
    return usage
  } catch (err) {
    errorlogger.logError({ merchantId, service: 'billing', action: 'trackUsage', error: err })
    throw err
  }
}

async function enforceLimits(merchantId) {
  try {
    const current = await getCurrentPlan(merchantId)
    if (!current) throw new Error('No active subscription')
    const limits = await getPlanLimits(current.planId)
    const now = new Date()
    if (current.trialEndsOn && new Date(current.trialEndsOn) > now) {
      return true
    }
    let periodStart
    if (current.billingOn) {
      const endDate = new Date(current.billingOn)
      periodStart = new Date(endDate)
      periodStart.setMonth(periodStart.getMonth() - 1)
    } else {
      periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - 30)
    }
    const usageSum = await db.getUsageSum(merchantId, periodStart)
    if (usageSum > limits.cappedAmount) {
      throw new Error('Usage limit exceeded')
    }
    return true
  } catch (err) {
    errorlogger.logError({ merchantId, service: 'billing', action: 'enforceLimits', error: err })
    throw err
  }
}

export { createCharge, getCurrentPlan, getPlanLimits, trackUsage, enforceLimits }