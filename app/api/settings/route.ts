import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { updateAppSettings, getAppSettings } from "@/lib/settings";
import { broadcast } from "@/lib/socket-bridge";
import { appSettingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData());

  // appIcon lands in a <link rel="icon"> and an <img src>, so it is restricted
  // to http(s) URLs and same-origin paths rather than accepted as-is.
  const parsed = appSettingsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 },
    );
  }

  const current = await getAppSettings();
  const appName = parsed.data.appName || current.appName;
  const appIcon = parsed.data.appIcon ?? current.appIcon;

  const settings = await updateAppSettings({ appName, appIcon });

  broadcast("settings:update", settings);

  return NextResponse.json({ ok: true, settings });
}
