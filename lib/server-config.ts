import "server-only";

import {
  APP_PORT,
  DOCKER_REDIS_HOST,
  LOCAL_REDIS_HOST,
  REDIS_PORT,
  getLocalRedisPort,
} from "@/lib/app-constants";
import { buildDatabaseUrl, isDockerRuntime } from "@/lib/database-url";

export function getPublicUrl() {
  const configured = process.env.PUBLIC_URL?.trim();
  return (configured && configured.replace(/\/+$/, "")) || `http://localhost:${APP_PORT}`;
}

export function getDatabaseUrl() {
  return buildDatabaseUrl();
}

export function getRedisUrl() {
  const docker = isDockerRuntime();
  const host = docker ? DOCKER_REDIS_HOST : LOCAL_REDIS_HOST;
  const port = docker ? REDIS_PORT : getLocalRedisPort();
  return `redis://${host}:${port}`;
}
