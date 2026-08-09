import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { pingRedis } from "@/lib/redis";

const log = createLogger("health");

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ms);
    }),
    // Clearing the timer keeps the request from being held open for the full
    // timeout after the check has already answered.
  ]).finally(() => clearTimeout(timer));
}

export async function GET() {
  const [dbOk, redisOk] = await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000)
      .then(() => true)
      .catch((error) => {
        log.error("Database non raggiungibile", error);
        return false;
      }),
    withTimeout(pingRedis(), 2000).catch((error) => {
      log.error("Redis non raggiungibile", error);
      return false;
    }),
  ]);

  const ok = dbOk && redisOk;

  return NextResponse.json(
    {
      ok,
      db: dbOk,
      redis: redisOk,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
