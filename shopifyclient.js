const { Shopify, ApiVersion } = require('@shopify/shopify-api');

class ShopifyClientWrapper {
  constructor({ shop, accessToken, locationId }) {
    if (!shop || !accessToken) {
      throw new Error('shop and accessToken are required to initialize ShopifyClientWrapper');
    }
    this.restClient = new Shopify.Clients.Rest(shop, accessToken, { apiVersion: ApiVersion.July22 });
    this.locationId = locationId;
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
    this.nextAttempt = Date.now();
    this.threshold = 5;
    this.cooldownPeriod = 30000;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async handleRateLimit(error) {
    const retryAfter = parseInt(error.response?.headers['retry-after'] || '1', 10);
    await this.sleep((retryAfter + 1) * 1000);
  }

  async retryRequest(requestFn, retries = 3, backoff = 1000) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await requestFn();
      } catch (error) {
        const status = error.response?.status;
        if (status === 429) {
          await this.handleRateLimit(error);
        } else if (status >= 500 || status === 408) {
          await this.sleep(backoff * Math.pow(2, attempt));
        } else {
          throw error;
        }
      }
      attempt++;
    }
    throw new Error(`Request failed after ${retries} retries`);
  }

  async withCircuitBreaker(fn) {
    if (this.circuitState === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is open');
      } else {
        this.circuitState = 'HALF_OPEN';
      }
    }

    try {
      const result = await fn();
      this.failureCount = 0;
      this.circuitState = 'CLOSED';
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.circuitState === 'HALF_OPEN') {
        this.circuitState = 'OPEN';
        this.nextAttempt = Date.now() + this.cooldownPeriod;
      } else if (this.failureCount >= this.threshold) {
        this.circuitState = 'OPEN';
        this.nextAttempt = Date.now() + this.cooldownPeriod;
      }
      throw error;
    }
  }

  async getProduct(productId) {
    return this.withCircuitBreaker(() =>
      this.retryRequest(() =>
        this.restClient.get({ path: `products/${productId}` })
      )
    );
  }

  async upsertProduct(productData) {
    const path = productData.id ? `products/${productData.id}` : 'products';
    const method = productData.id ? 'put' : 'post';
    return this.withCircuitBreaker(() =>
      this.retryRequest(() =>
        this.restClient[method]({
          path,
          data: { product: productData },
          type: Shopify.DataType.JSON
        })
      )
    );
  }

  async getInventoryLevel(inventoryItemId) {
    const resp = await this.withCircuitBreaker(() =>
      this.retryRequest(() =>
        this.restClient.get({
          path: 'inventory_levels',
          query: { inventory_item_ids: inventoryItemId.toString() }
        })
      )
    );
    const levels = resp.body?.inventory_levels || [];
    return levels.length ? levels[0] : null;
  }

  async updateInventoryLevel(inventoryItemId, available) {
    return this.withCircuitBreaker(async () => {
      // Fetch existing level without additional circuit wrapping
      const resp = await this.retryRequest(() =>
        this.restClient.get({
          path: 'inventory_levels',
          query: { inventory_item_ids: inventoryItemId.toString() }
        })
      );
      const levels = resp.body?.inventory_levels || [];
      const level = levels.length ? levels[0] : null;
      const location = level ? level.location_id : this.locationId;
      if (!location) {
        throw new Error('locationId is required to set inventory level');
      }
      return this.retryRequest(() =>
        this.restClient.post({
          path: 'inventory_levels/set',
          data: {
            location_id: location,
            inventory_item_id: inventoryItemId,
            available
          },
          type: Shopify.DataType.JSON
        })
      );
    });
  }
}

function createClient(merchantCredentials) {
  return new ShopifyClientWrapper(merchantCredentials);
}

module.exports = { createClient }