import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { clearStoredEmbedState, resolveEmbedPayload, setStoredEmbedState } from "@/lib/embed-state";
import { broadcast } from "@/lib/socket-bridge";
import type { StoredEmbedState } from "@/lib/types";

export async function GET() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await resolveEmbedPayload());
}

export async function POST(request: Request) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json()) as StoredEmbedState;

  if (payload.kind === "none") {
    await clearStoredEmbedState();
  } else {
    await setStoredEmbedState(payload);
  }

  const embed = await resolveEmbedPayload();
  broadcast("embed:update", embed);

  return NextResponse.json({ ok: true, embed });
}
