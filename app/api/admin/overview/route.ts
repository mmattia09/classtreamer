import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { getAdminOverview } from "@/lib/admin-data";

export async function GET() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await getAdminOverview();
  return NextResponse.json(payload);
}
