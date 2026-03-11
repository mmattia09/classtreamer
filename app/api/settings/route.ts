import { NextResponse } from "next/server";

import { normalizeHex } from "@/lib/app-config";
import { updateAppSettings, getAppSettings } from "@/lib/settings";
import { broadcast } from "@/lib/socket-bridge";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? ((await request.json()) as {
          appName?: string;
          appIcon?: string;
          appBgColor?: string;
          appMainColor?: string;
          appLightColor?: string;
        })
      : Object.fromEntries(await request.formData());

  const current = await getAppSettings();
  const appName = typeof payload.appName === "string" ? payload.appName.trim() : current.appName;
  const appIcon = typeof payload.appIcon === "string" ? payload.appIcon.trim() : current.appIcon;
  const appBgColor = normalizeHex(typeof payload.appBgColor === "string" ? payload.appBgColor : "") ?? current.appBgColor;
  const appMainColor = normalizeHex(typeof payload.appMainColor === "string" ? payload.appMainColor : "") ?? current.appMainColor;
  const appLightColor = normalizeHex(typeof payload.appLightColor === "string" ? payload.appLightColor : "") ?? current.appLightColor;

  const settings = await updateAppSettings({
    appName: appName.length > 0 ? appName : current.appName,
    appIcon: appIcon.length > 0 ? appIcon : current.appIcon,
    appBgColor,
    appMainColor,
    appLightColor,
  });
  broadcast("settings:update", settings);

  return NextResponse.json({ ok: true, settings });
}
