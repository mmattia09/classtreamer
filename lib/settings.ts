import { APP_BRAND_DEFAULTS, resolveAppBrandIcon } from "@/lib/settings-defaults";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { AppSetting } from "@prisma/client";

const SETTINGS_ID = "singleton";

export type AppSettings = {
  appName: string;
  appIcon: string;
};

let ensureSettingsInFlight: Promise<AppSetting> | null = null;

async function ensureSettings(): Promise<AppSetting> {
  if (ensureSettingsInFlight) {
    return ensureSettingsInFlight;
  }

  ensureSettingsInFlight = (async () => {
    const existing = await prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
    });
    if (existing) {
      return existing;
    }

    try {
      return await prisma.appSetting.create({
        data: {
          id: SETTINGS_ID,
          appName: APP_BRAND_DEFAULTS.name,
          appIcon: APP_BRAND_DEFAULTS.icon,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const current = await prisma.appSetting.findUnique({
          where: { id: SETTINGS_ID },
        });
        if (current) {
          return current;
        }
      }
      throw error;
    }
  })();

  try {
    return await ensureSettingsInFlight;
  } finally {
    ensureSettingsInFlight = null;
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await ensureSettings();

  return {
    appName: settings.appName ?? APP_BRAND_DEFAULTS.name,
    appIcon: resolveAppBrandIcon(settings.appIcon),
  };
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = { ...current, ...payload };
  const appIcon = resolveAppBrandIcon(next.appIcon);

  const settings = await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    update: { appName: next.appName, appIcon },
    create: { id: SETTINGS_ID, appName: next.appName, appIcon },
  });

  return {
    appName: settings.appName ?? APP_BRAND_DEFAULTS.name,
    appIcon: resolveAppBrandIcon(settings.appIcon),
  };
}
