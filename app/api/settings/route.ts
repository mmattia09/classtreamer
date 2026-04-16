import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { updateAppSettings, getAppSettings } from "@/lib/settings";
import { broadcast } from "@/lib/socket-bridge";

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
  const payload =
    contentType.includes("application/json")
      ? ((await request.json()) as { appName?: string; appIcon?: string })
      : Object.fromEntries(await request.formData());

  const current = await getAppSettings();
  const appName = typeof payload.appName === "string" ? payload.appName.trim() : current.appName;
  const appIcon = typeof payload.appIcon === "string" ? payload.appIcon.trim() : current.appIcon;

  const settings = await updateAppSettings({
    appName: appName.length > 0 ? appName : current.appName,
    appIcon,
  });

  broadcast("settings:update", settings);

  return NextResponse.json({ ok: true, settings });
}
