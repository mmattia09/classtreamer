import { NextResponse } from "next/server";

import { clearStoredEmbedState, resolveEmbedPayload, setStoredEmbedState } from "@/lib/embed-state";
import { broadcast } from "@/lib/socket-bridge";
import type { StoredEmbedState } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await resolveEmbedPayload());
}

export async function POST(request: Request) {
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
