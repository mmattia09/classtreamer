import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: bun ./scripts/with-derived-env.mjs <command> [...args]");
  process.exit(1);
}

function buildDatabaseUrl() {
  const name = process.env.DB_NAME?.trim();
  const user = process.env.DB_USER?.trim();
  const password = process.env.DB_PASSWORD?.trim();

  if (!name || !user || !password) {
    return process.env.DB_URL;
  }

  const host = existsSync("/.dockerenv") ? "postgres" : "localhost";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${name}?schema=public`;
}

const derivedDatabaseUrl = buildDatabaseUrl();

const child = spawn(command, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(derivedDatabaseUrl ? { DB_URL: derivedDatabaseUrl } : {}),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
