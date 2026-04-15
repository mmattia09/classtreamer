import { NextResponse } from "next/server";

import { resolveEmbedPayload } from "@/lib/embed-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await resolveEmbedPayload());
}
