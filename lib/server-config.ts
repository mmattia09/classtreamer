import "server-only";
import { existsSync } from "node:fs";

import {
  APP_PORT,
  DB_PORT,
  DOCKER_DB_HOST,
  DOCKER_REDIS_HOST,
  LOCAL_DB_HOST,
  LOCAL_REDIS_HOST,
  REDIS_PORT,
} from "@/lib/app-constants";

function isDockerRuntime() {
  return existsSync("/.dockerenv");
}

export function getPublicUrl() {
  const configured = process.env.PUBLIC_URL?.trim();
  return (configured && configured.replace(/\/+$/, "")) || `http://localhost:${APP_PORT}`;
}

export function getDatabaseUrl() {
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();

  if (!name || !user || !password) {
    return null;
  }

  const host = isDockerRuntime() ? DOCKER_DB_HOST : LOCAL_DB_HOST;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${DB_PORT}/${name}?schema=public`;
}

export function getRedisUrl() {
  const host = isDockerRuntime() ? DOCKER_REDIS_HOST : LOCAL_REDIS_HOST;
  return `redis://${host}:${REDIS_PORT}`;
}
