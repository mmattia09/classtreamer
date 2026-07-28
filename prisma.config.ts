import path from "node:path";

import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env on its own. In Docker the variables already come
// from env_file, so a missing .env here is expected and not an error.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env file — rely on the ambient environment.
}

const { buildDatabaseUrl } = await import("./lib/database-url");

// The migrate/introspect connection string lives here rather than in
// schema.prisma, derived from DB_NAME / DB_USER / DB_PASSWORD so that .env stays
// the single place credentials are configured — the same derivation the app uses
// at runtime.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: buildDatabaseUrl() ?? undefined,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
