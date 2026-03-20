import Redis from "ioredis";

import { getRedisUrl } from "@/lib/server-config";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

export const redis =
  globalForRedis.redis ??
  new Redis(getRedisUrl(), {
    commandTimeout: 1000,
    connectTimeout: 1000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

redis.on("error", () => {
  // Redis can be unavailable during build or local boot; rate limiting handles runtime failures.
});
