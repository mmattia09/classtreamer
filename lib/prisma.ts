import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "@/lib/server-config";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = getDatabaseUrl();

  if (!connectionString) {
    throw new Error(
      "Database non configurato: imposta DB_NAME, DB_USER e DB_PASSWORD (vedi .env.example).",
    );
  }

  // Prisma 7 talks to Postgres through a driver adapter instead of the Rust
  // query engine, so the connection string is passed to the client directly.
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

let instance: PrismaClient | null = null;

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  if (!instance) {
    instance = createPrismaClient();
    // Reuse the client across hot reloads in development; in production the
    // module is evaluated once per process anyway.
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = instance;
    }
  }

  return instance;
}

/**
 * Connects on first use rather than on import. `next build` evaluates every
 * route module to collect page data, and the database credentials are not
 * present at build time — creating the client eagerly would fail the build.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
