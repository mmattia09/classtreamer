import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAdminSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = (await request.json()) as { password?: string };
  const expected = process.env.ADMIN_PASSWORD ?? "";

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

  await createAdminSession({ secure });
  return NextResponse.json({ ok: true });
}
