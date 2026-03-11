import { NextResponse } from "next/server";

import { getAdminOverview } from "@/lib/admin-data";

export async function GET() {
  const payload = await getAdminOverview();
  return NextResponse.json(payload);
}
