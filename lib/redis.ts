import Redis from "ioredis";

import { getRedisUrl } from "@/lib/server-config";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedisClient() {
  const client = new Redis(getRedisUrl(), {
    commandTimeout: 1000,
    connectTimeout: 1000,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  client.on("error", () => {
    // Redis may be unavailable during build or local boot. Callers below treat
    // a failure as "no rate limiting" rather than as a request error, so this
    // handler only exists to stop an unhandled 'error' event from crashing the
    // process.
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Resolve to a connected client, connecting on first use.
 *
 * The client is lazyConnect with enableOfflineQueue disabled, so any command
 * issued before an explicit connect() is rejected outright with "Stream isn't
 * writeable". /api/health used to call redis.ping() directly and therefore
 * always reported Redis as down — which kept the Compose healthcheck failing
 * and the app container permanently unhealthy.
 */
export async function getConnectedRedis() {
  if (redis.status === "wait" || redis.status === "end") {
    await redis.connect();
  }
  return redis;
}

/** True when Redis answers a PING. Never throws. */
export async function pingRedis() {
  try {
    const client = await getConnectedRedis();
    return (await client.ping()) === "PONG";
  } catch {
    return false;
  }
}
