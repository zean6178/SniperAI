/**
 * Redis — Cache + Pub/Sub for real-time data
 * 
 * Uses in-memory fallback if Redis is not available.
 */

let redisClient = null;
let pubClient = null;
let subClient = null;
let useInMemory = true;

// In-memory fallback
const memoryCache = new Map();
const subscribers = new Map(); // channel → Set<callback>

/**
 * Initialize Redis connection
 */
export async function initRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[redis] No REDIS_URL configured — using in-memory cache');
    useInMemory = true;
    return;
  }

  try {
    const { createClient } = await import('redis');

    redisClient = createClient({ url: redisUrl });
    pubClient = createClient({ url: redisUrl });
    subClient = createClient({ url: redisUrl });

    await redisClient.connect();
    await pubClient.connect();
    await subClient.connect();

    useInMemory = false;
    console.log('[redis] ✅ Connected to Redis');
  } catch (e) {
    console.warn(`[redis] Connection failed: ${e.message} — falling back to in-memory`);
    useInMemory = true;
  }
}

/**
 * Get cached value
 */
export async function getCache(key) {
  if (useInMemory) {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }
  const val = await redisClient.get(key);
  return val ? JSON.parse(val) : null;
}

/**
 * Set cache with optional TTL (seconds)
 */
export async function setCache(key, value, ttlSeconds = 300) {
  if (useInMemory) {
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return;
  }
  await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
}

/**
 * Delete cache key
 */
export async function deleteCache(key) {
  if (useInMemory) {
    memoryCache.delete(key);
    return;
  }
  await redisClient.del(key);
}

/**
 * Publish message to channel
 */
export async function publishToRedis(channel, data) {
  if (useInMemory) {
    const subs = subscribers.get(channel);
    if (subs) {
      for (const cb of subs) cb(data);
    }
    return;
  }
  await pubClient.publish(channel, JSON.stringify(data));
}

/**
 * Subscribe to channel
 */
export async function subscribeToRedis(channel, callback) {
  if (useInMemory) {
    if (!subscribers.has(channel)) subscribers.set(channel, new Set());
    subscribers.get(channel).add(callback);
    return;
  }
  await subClient.subscribe(channel, (message) => {
    try {
      callback(JSON.parse(message));
    } catch {
      callback(message);
    }
  });
}

/**
 * Cleanup
 */
export async function closeRedis() {
  if (!useInMemory) {
    await redisClient?.disconnect();
    await pubClient?.disconnect();
    await subClient?.disconnect();
  }
}
