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

  await createAdminSession();
  return NextResponse.json({ ok: true });
}
