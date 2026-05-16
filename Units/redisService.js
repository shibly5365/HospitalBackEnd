import { getRedisClient, isRedisAvailable } from "../Config/redis.js";
import logger from "../Config/logger.js";

/**
 * Redis Service Wrapper
 * Provides reusable Redis operations with fallback for when Redis is unavailable
 */

class RedisService {
  /**
   * Get value from Redis
   * Returns null if Redis unavailable or key doesn't exist
   */
  async get(key) {
    try {
      if (!isRedisAvailable()) return null;

      const client = getRedisClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.warn("Redis get error", { key, error: error.message });
      return null;
    }
  }

  /**
   * Set value in Redis with optional TTL (seconds)
   */
  async set(key, value, ttl = null) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      const serialized = JSON.stringify(value);

      if (ttl) {
        await client.setEx(key, ttl, serialized);
      } else {
        await client.set(key, serialized);
      }

      return true;
    } catch (error) {
      logger.warn("Redis set error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete value from Redis
   */
  async delete(key) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      logger.warn("Redis delete error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete multiple keys
   */
  async deleteMany(keys) {
    try {
      if (!isRedisAvailable() || keys.length === 0) return false;

      const client = getRedisClient();
      await client.del(keys);
      return true;
    } catch (error) {
      logger.warn("Redis deleteMany error", { keys, error: error.message });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.warn("Redis exists error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Increment value (for counters)
   */
  async increment(key, amount = 1, ttl = null) {
    try {
      if (!isRedisAvailable()) return null;

      const client = getRedisClient();
      const value = await client.incrBy(key, amount);

      if (ttl && value === amount) {
        await client.expire(key, ttl);
      }

      return value;
    } catch (error) {
      logger.warn("Redis increment error", { key, error: error.message });
      return null;
    }
  }

  /**
   * Set with NX (only if not exists)
   * Useful for distributed locks
   */
  async setNX(key, value, ttl = null) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      const serialized = JSON.stringify(value);

      const result = await client.set(key, serialized, {
        NX: true,
        EX: ttl,
      });

      return result !== null;
    } catch (error) {
      logger.warn("Redis setNX error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Get all keys matching pattern
   * Use cautiously in production (can be slow with large datasets)
   */
  async getByPattern(pattern) {
    try {
      if (!isRedisAvailable()) return [];

      const client = getRedisClient();
      const keys = await client.keys(pattern);
      return keys;
    } catch (error) {
      logger.warn("Redis getByPattern error", { pattern, error: error.message });
      return [];
    }
  }

  /**
   * Push to list
   */
  async pushToList(key, value, ttl = null) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      const serialized = JSON.stringify(value);

      await client.rPush(key, serialized);

      if (ttl) {
        await client.expire(key, ttl);
      }

      return true;
    } catch (error) {
      logger.warn("Redis pushToList error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Get list range
   */
  async getList(key, start = 0, stop = -1) {
    try {
      if (!isRedisAvailable()) return [];

      const client = getRedisClient();
      const values = await client.lRange(key, start, stop);

      return values.map((v) => {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      });
    } catch (error) {
      logger.warn("Redis getList error", { key, error: error.message });
      return [];
    }
  }

  /**
   * Add to set
   */
  async addToSet(key, value, ttl = null) {
    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      const serialized = JSON.stringify(value);

      await client.sAdd(key, serialized);

      if (ttl) {
        await client.expire(key, ttl);
      }

      return true;
    } catch (error) {
      logger.warn("Redis addToSet error", { key, error: error.message });
      return false;
    }
  }

  /**
   * Get set members
   */
  async getSet(key) {
    try {
      if (!isRedisAvailable()) return [];

      const client = getRedisClient();
      const members = await client.sMembers(key);

      return members.map((m) => {
        try {
          return JSON.parse(m);
        } catch {
          return m;
        }
      });
    } catch (error) {
      logger.warn("Redis getSet error", { key, error: error.message });
      return [];
    }
  }

  /**
   * Clear all keys (be very careful with this!)
   * Only for development/testing
   */
  async flushAll() {
    if (process.env.NODE_ENV === "production") {
      logger.error("Attempted FLUSHALL in production - BLOCKED");
      return false;
    }

    try {
      if (!isRedisAvailable()) return false;

      const client = getRedisClient();
      await client.flushAll();
      logger.warn("Redis flushed all keys");
      return true;
    } catch (error) {
      logger.error("Redis flushAll error", { error: error.message });
      return false;
    }
  }
}

export default new RedisService();
