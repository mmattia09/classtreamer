import { redis } from "@/lib/redis";

var RATE_LIMIT = 500; // Max requests
var RATE_LIMIT_WINDOW_SECONDS = 10; // Time window in seconds

async function ensureRedisConnection() {
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export async function consumeRateLimit(key: string, limit = RATE_LIMIT, windowSeconds = RATE_LIMIT_WINDOW_SECONDS) {
  try {
    await ensureRedisConnection();

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    const ttl = await redis.ttl(key);
    return {
      allowed: current <= limit,
      current,
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  } catch {
    return {
      allowed: true,
      current: 0,
      retryAfter: windowSeconds,
    };
  }
}

export async function checkRateLimit(key: string, limit = RATE_LIMIT, windowSeconds = RATE_LIMIT_WINDOW_SECONDS) {
  try {
    const result = await consumeRateLimit(key, limit, windowSeconds);
    return result.allowed;
  } catch {
    return true;
  }
}

export async function resetRateLimit(key: string) {
  try {
    await ensureRedisConnection();
    await redis.del(key);
  } catch {
    // Ignore Redis failures: auth can continue without reset.
  }
}
