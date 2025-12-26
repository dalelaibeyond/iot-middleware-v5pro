const Logger = require('../../../core/Logger');

/**
 * StateCache - In-memory cache for maintaining device shadow state
 * Stores RFID tag state per module for diffing operations
 */
class StateCache {
  constructor() {
    this.logger = Logger;
    this.cache = new Map(); // Key: `${deviceId}:${modAddr}`, Value: Map<uPos, TagData>
  }

  /**
   * Get cached state for a specific module
   * @param {string} deviceId - Device identifier
   * @param {number} modAddr - Module address
   * @returns {Promise<Map|null>} Cached tag data map or null if not found
   */
  async get(deviceId, modAddr) {
    const key = this._createKey(deviceId, modAddr);
    const cached = this.cache.get(key);
    
    this.logger.debug(`StateCache: Get cache for ${key}`, {
      found: !!cached,
      tagCount: cached ? cached.size : 0
    });
    
    return cached || null;
  }

  /**
   * Set cached state for a specific module
   * @param {string} deviceId - Device identifier
   * @param {number} modAddr - Module address
   * @param {Map} tagDataMap - Map of uPos to TagData
   */
  async set(deviceId, modAddr, tagDataMap) {
    const key = this._createKey(deviceId, modAddr);
    
    if (!tagDataMap || !(tagDataMap instanceof Map)) {
      this.logger.warn(`StateCache: Invalid tagDataMap provided for ${key}`);
      return;
    }
    
    this.cache.set(key, new Map(tagDataMap));
    
    this.logger.debug(`StateCache: Set cache for ${key}`, {
      tagCount: tagDataMap.size
    });
  }

  /**
   * Clear cached state for a specific module
   * @param {string} deviceId - Device identifier
   * @param {number} modAddr - Module address
   */
  async clear(deviceId, modAddr) {
    const key = this._createKey(deviceId, modAddr);
    const existed = this.cache.has(key);
    
    this.cache.delete(key);
    
    this.logger.debug(`StateCache: Clear cache for ${key}`, {
      existed
    });
    
    return existed;
  }

  /**
   * Check if cache exists for a specific module
   * @param {string} deviceId - Device identifier
   * @param {number} modAddr - Module address
   * @returns {boolean} True if cache exists
   */
  async has(deviceId, modAddr) {
    const key = this._createKey(deviceId, modAddr);
    return this.cache.has(key);
  }

  /**
   * Get all cached keys
   * @returns {Array<string>} Array of cache keys
   */
  async keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear all cached state
   */
  async clearAll() {
    const size = this.cache.size;
    this.cache.clear();
    
    this.logger.debug('StateCache: Clear all cache', {
      clearedCount: size
    });
  }

  /**
   * Get cache statistics
   * @returns {Object} Statistics about cache usage
   */
  getStats() {
    const stats = {
      totalModules: this.cache.size,
      totalTags: 0,
      modules: []
    };
    
    for (const [key, tagMap] of this.cache.entries()) {
      const [deviceId, modAddr] = this._parseKey(key);
      const tagCount = tagMap ? tagMap.size : 0;
      
      stats.totalTags += tagCount;
      stats.modules.push({
        deviceId,
        modAddr,
        tagCount
      });
    }
    
    return stats;
  }

  /**
   * Create cache key from device and module
   * @param {string} deviceId - Device identifier
   * @param {number} modAddr - Module address
   * @returns {string} Cache key
   * @private
   */
  _createKey(deviceId, modAddr) {
    return `${deviceId}:${modAddr}`;
  }

  /**
   * Parse cache key back to device and module
   * @param {string} key - Cache key
   * @returns {Array} [deviceId, modAddr]
   * @private
   */
  _parseKey(key) {
    const parts = key.split(':');
    return [parts[0], parseInt(parts[1], 10)];
  }
}

module.exports = StateCache;