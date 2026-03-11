import { APP_BRAND_DEFAULTS } from "@/lib/settings-defaults";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

export type AppSettings = {
  appName: string;
  appIcon: string;
  appBgColor: string;
  appMainColor: string;
  appLightColor: string;
};

async function ensureSettings() {
  const existing = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }
  return prisma.appSetting.create({
    data: {
      id: SETTINGS_ID,
      appName: APP_BRAND_DEFAULTS.name,
      appIcon: APP_BRAND_DEFAULTS.icon,
      appBgColor: APP_BRAND_DEFAULTS.colors.bg,
      appMainColor: APP_BRAND_DEFAULTS.colors.main,
      appLightColor: APP_BRAND_DEFAULTS.colors.light,
    },
  });
}

export async function getAppSettings(): Promise<AppSettings> {
  const settings = await ensureSettings();

  return {
    appName: settings.appName ?? APP_BRAND_DEFAULTS.name,
    appIcon: settings.appIcon ?? APP_BRAND_DEFAULTS.icon,
    appBgColor: settings.appBgColor ?? APP_BRAND_DEFAULTS.colors.bg,
    appMainColor: settings.appMainColor ?? APP_BRAND_DEFAULTS.colors.main,
    appLightColor: settings.appLightColor ?? APP_BRAND_DEFAULTS.colors.light,
  };
}

export async function updateAppSettings(payload: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = {
    ...current,
    ...payload,
  };

  const settings = await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    update: {
      appName: next.appName,
      appIcon: next.appIcon,
      appBgColor: next.appBgColor,
      appMainColor: next.appMainColor,
      appLightColor: next.appLightColor,
    },
    create: {
      id: SETTINGS_ID,
      appName: next.appName,
      appIcon: next.appIcon,
      appBgColor: next.appBgColor,
      appMainColor: next.appMainColor,
      appLightColor: next.appLightColor,
    },
  });

  return {
    appName: settings.appName ?? APP_BRAND_DEFAULTS.name,
    appIcon: settings.appIcon ?? APP_BRAND_DEFAULTS.icon,
    appBgColor: settings.appBgColor ?? APP_BRAND_DEFAULTS.colors.bg,
    appMainColor: settings.appMainColor ?? APP_BRAND_DEFAULTS.colors.main,
    appLightColor: settings.appLightColor ?? APP_BRAND_DEFAULTS.colors.light,
  };
}
