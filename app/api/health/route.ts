import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);
}

export async function GET() {
  let dbOk = false;
  let redisOk = false;

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 2000);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  try {
    await withTimeout(redis.ping(), 2000);
    redisOk = true;
  } catch {
    redisOk = false;
  }

  const ok = dbOk && redisOk;

  return NextResponse.json(
    {
      ok,
      db: dbOk,
      redis: redisOk,
      ts: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}

