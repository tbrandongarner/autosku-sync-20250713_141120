async function getShopifySession(_merchantId) {
  return { shop: 'example.myshopify.com', accessToken: 'test' }
}

async function saveCharge() {}
async function getCharge() { return null }
async function saveUsage() {}
async function getUsageSum() { return 0 }

module.exports = {
  getShopifySession,
  saveCharge,
  getCharge,
  saveUsage,
  getUsageSum,
}
