export const APP_PORT = 3000;
export const SOCKET_PATH = "/socket.io";

export const DOCKER_DB_HOST = "postgres";
export const LOCAL_DB_HOST = "127.0.0.1";
/** Port Postgres listens on inside the Compose network. */
export const DB_PORT = 5432;

export const DOCKER_REDIS_HOST = "redis";
export const LOCAL_REDIS_HOST = "127.0.0.1";
/** Port Redis listens on inside the Compose network. */
export const REDIS_PORT = 6379;

function hostPort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : fallback;
}

/**
 * Port to reach the containers on from the host machine. Configurable so the
 * stack can run next to another project already using 5432 or 6379; inside the
 * Compose network the fixed container ports are used instead.
 */
export function getLocalDbPort() {
  return hostPort(process.env.DB_HOST_PORT, DB_PORT);
}

export function getLocalRedisPort() {
  return hostPort(process.env.REDIS_HOST_PORT, REDIS_PORT);
}
