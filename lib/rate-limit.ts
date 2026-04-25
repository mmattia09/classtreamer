import { redis } from "@/lib/redis";

const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_SECONDS = 10;

async function ensureRedisConnection() {
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export async function consumeRateLimit(key: string, limit = RATE_LIMIT, windowSeconds = RATE_LIMIT_WINDOW_SECONDS) {
  try {
    await ensureRedisConnection();

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds, "NX");
    pipeline.ttl(key);
    const results = await pipeline.exec();
    const current = (results?.[0]?.[1] ?? 0) as number;
    const ttl = (results?.[2]?.[1] ?? windowSeconds) as number;
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
