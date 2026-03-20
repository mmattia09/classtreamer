import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAdminSession } from "@/lib/auth";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
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

  const valid =
    expected.startsWith("$2")
      ? await bcrypt.compare(password ?? "", expected)
      : password === expected;

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
