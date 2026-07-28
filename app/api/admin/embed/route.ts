import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { clearStoredEmbedState, resolveEmbedPayload, setStoredEmbedState } from "@/lib/embed-state";
import { broadcast } from "@/lib/socket-bridge";
import { embedStateSchema, parseJsonBody } from "@/lib/validation";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await resolveEmbedPayload());
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, embedStateSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }

  if (parsed.data.kind === "none") {
    await clearStoredEmbedState();
  } else {
    await setStoredEmbedState(parsed.data);
  }

  const embed = await resolveEmbedPayload();
  broadcast("embed:update", embed);

  return NextResponse.json({ ok: true, embed });
}
