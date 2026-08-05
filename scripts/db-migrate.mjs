#!/usr/bin/env bun
/**
 * Applies the database schema, handling three cases:
 *
 *   1. Empty database          → `migrate deploy` creates everything.
 *   2. Already on migrations   → `migrate deploy` applies what is pending.
 *   3. Created by `db push`    → baseline first, then deploy.
 *
 * Case 3 is the upgrade path from before migrations existed. `migrate deploy`
 * refuses to run against a non-empty schema it has no history for, so those
 * databases are brought up to the current schema with a final `db push` and
 * the baseline migration is then recorded as applied. Without this the app
 * container would fail to start on every existing install.
 */

import path from "node:path";
import { spawn } from "node:child_process";

import pg from "pg";

import { buildDatabaseUrl } from "../lib/database-url.ts";

const BASELINE_MIGRATION = "0_init";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file — rely on the ambient environment (Docker passes env_file).
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} → exit ${code}`)),
    );
  });
}

/** Which of the three cases above we are in. */
async function inspectDatabase(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        to_regclass('public."_prisma_migrations"') IS NOT NULL AS has_history,
        to_regclass('public."Class"')              IS NOT NULL AS has_tables
    `);
    return rows[0];
  } finally {
    await client.end();
  }
}

async function main() {
  const connectionString = buildDatabaseUrl();
  if (!connectionString) {
    console.error("Database non configurato: imposta DB_NAME, DB_USER e DB_PASSWORD.");
    process.exit(1);
  }

  const { has_history: hasHistory, has_tables: hasTables } = await inspectDatabase(connectionString);

  if (!hasHistory && hasTables) {
    console.log(
      `==> Database esistente creato con 'db push': allineo lo schema e registro ${BASELINE_MIGRATION} come applicata`,
    );
    // Brings a database created before migrations existed up to the current
    // schema, so recording the baseline as applied is truthful. Without
    // --accept-data-loss this refuses destructive changes and stops, which is
    // the outcome we want: an unexpected divergence needs a human.
    await run("bunx", ["prisma", "db", "push"]);
    await run("bunx", ["prisma", "migrate", "resolve", "--applied", BASELINE_MIGRATION]);
  }

  console.log("==> Applico le migration in sospeso");
  await run("bunx", ["prisma", "migrate", "deploy"]);
}

main().catch((error) => {
  console.error(`\nMigrazione fallita: ${error.message}`);
  process.exit(1);
});
