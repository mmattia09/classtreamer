import { createLogger } from "@/lib/logger";
import { getConnectedRedis } from "@/lib/redis";

const RATE_LIMIT = 100;
const RATE_LIMIT_WINDOW_SECONDS = 10;

const log = createLogger("rate-limit");

export async function consumeRateLimit(
  key: string,
  limit = RATE_LIMIT,
  windowSeconds = RATE_LIMIT_WINDOW_SECONDS,
) {
  try {
    const redis = await getConnectedRedis();

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    // NX: only set the TTL on the first increment, so the window does not slide
    // forward with every request and never expire.
    pipeline.expire(key, windowSeconds, "NX");
    pipeline.ttl(key);
    const results = await pipeline.exec();

    // A pipeline entry is [error, value]; a failed command must not be read as
    // a zero counter, which would silently disable the limit.
    const incrementError = results?.[0]?.[0];
    if (incrementError) {
      throw incrementError;
    }

    const current = Number(results?.[0]?.[1] ?? 0);
    const ttl = Number(results?.[2]?.[1] ?? windowSeconds);

    return {
      allowed: current <= limit,
      current,
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    // Fail open: Redis being down should not lock students out of answering.
    // Login brute-force protection degrades with it, which is why server.js
    // refuses to start in production without a real ADMIN_PASSWORD — and why
    // this is logged rather than swallowed.
    log.warn("Rate limit non applicato, Redis non raggiungibile", { key }, error);
    return {
      allowed: true,
      current: 0,
      retryAfter: windowSeconds,
    };
  }
}

export async function checkRateLimit(
  key: string,
  limit = RATE_LIMIT,
  windowSeconds = RATE_LIMIT_WINDOW_SECONDS,
) {
  const result = await consumeRateLimit(key, limit, windowSeconds);
  return result.allowed;
}

export async function resetRateLimit(key: string) {
  try {
    const redis = await getConnectedRedis();
    await redis.del(key);
  } catch (error) {
    // Not fatal: a successful login just leaves its attempt counter to expire
    // on its own.
    log.debug("Reset del contatore non riuscito", { key, error: String(error) });
  }
}
