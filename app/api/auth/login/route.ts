import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAdminSession } from "@/lib/auth";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/safe-compare";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const expected = process.env.ADMIN_PASSWORD ?? "";

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateLimitKey = `rate:login:${ip}`;
  const rateLimit = await consumeRateLimit(rateLimitKey, 5, 300);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      },
    );
  }

  // Without this guard an unset ADMIN_PASSWORD compares against "", so posting
  // an empty password would grant an admin session.
  if (!expected) {
    console.error("[auth] ADMIN_PASSWORD non impostato: login amministratore disabilitato.");
    return NextResponse.json({ error: "Admin login not configured" }, { status: 503 });
  }

  // A value starting with $2 is a bcrypt hash; anything else is a plain
  // password, compared in constant time.
  const valid = expected.startsWith("$2")
    ? await bcrypt.compare(password, expected)
    : safeEqual(password, expected);

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.toLowerCase();
  const isHttps = forwardedProto === "https" || new URL(request.url).protocol === "https:";
  const secureOverride = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  const secure =
    secureOverride === "true" ? true : secureOverride === "false" ? false : isHttps;

  await resetRateLimit(rateLimitKey);
  await createAdminSession({ secure });
  return NextResponse.json({ ok: true });
}
