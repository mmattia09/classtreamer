import { redis } from "@/lib/redis";

export async function checkRateLimit(key: string, limit = 5, windowSeconds = 10) {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    return current <= limit;
  } catch {
    return true;
  }
}
