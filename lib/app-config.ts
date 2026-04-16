import type { Metadata, Viewport } from "next";
import type { AppSettings } from "@/lib/settings";
import { APP_BRAND_DEFAULTS, resolveAppBrandIcon } from "@/lib/settings-defaults";

export function buildAppConfig(input: Partial<AppSettings> = {}) {
  const name = input.appName?.trim() || APP_BRAND_DEFAULTS.name;
  const icon = resolveAppBrandIcon(input.appIcon);

  return { name, description: APP_BRAND_DEFAULTS.description, icon };
}

export function getAppMetadata(config: ReturnType<typeof buildAppConfig>): Metadata {
  return {
    title: config.name,
    description: config.description,
    icons: config.icon ? { icon: config.icon } : undefined,
  };
}

export function getAppViewport(): Viewport {
  return { themeColor: "#4F46E5" };
}
