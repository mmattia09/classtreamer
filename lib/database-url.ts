import { existsSync } from "node:fs";

import { DB_PORT, DOCKER_DB_HOST, LOCAL_DB_HOST, getLocalDbPort } from "./app-constants";

// Imported both by the app (through lib/server-config.ts) and by the Prisma CLI
// through prisma.config.ts, so it stays free of "server-only" and of the "@/"
// path alias — the CLI loads this file outside the Next.js bundler.

export function isDockerRuntime() {
  return existsSync("/.dockerenv");
}

/**
 * Build the Postgres connection string from the individual DB_* variables.
 * The host is the only part that differs between running inside Compose and
 * running against the containers from the host machine.
 *
 * Returns null when the credentials are incomplete, so callers can fail with a
 * clear message instead of handing a malformed URL to the driver.
 */
export function buildDatabaseUrl(): string | null {
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();

  if (!name || !user || !password) {
    return null;
  }

  const docker = isDockerRuntime();
  const host = docker ? DOCKER_DB_HOST : LOCAL_DB_HOST;
  const port = docker ? DB_PORT : getLocalDbPort();
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}?schema=public`;
}
