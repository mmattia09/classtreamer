import { NextResponse } from "next/server";

import { clearAdminSession } from "@/lib/auth";
import { getPublicUrl } from "@/lib/server-config";

export async function POST() {
  await clearAdminSession();
  return NextResponse.redirect(new URL("/admin", getPublicUrl()), 303);
}
