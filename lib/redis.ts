import Redis from "ioredis";

import { createLogger } from "@/lib/logger";
import { getRedisUrl } from "@/lib/server-config";

const log = createLogger("redis");

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

  // Redis may be unavailable during build or local boot, and callers treat a
  // failure as "no rate limiting" rather than as a request error — so this
  // handler mainly exists to stop an unhandled 'error' event from crashing the
  // process. It logs at most once per outage instead of on every retry, which
  // would otherwise flood the log while Redis is down.
  let reportedDown = false;

  client.on("error", (error) => {
    if (reportedDown) return;
    reportedDown = true;
    log.error("Connessione a Redis non disponibile", error, { url: getRedisUrl() });
  });

  client.on("ready", () => {
    if (reportedDown) log.info("Connessione a Redis ristabilita");
    reportedDown = false;
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
