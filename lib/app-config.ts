import type { Metadata, Viewport } from "next";
import type { AppSettings } from "@/lib/settings";
import { APP_BRAND_DEFAULTS, resolveAppBrandIcon } from "@/lib/settings-defaults";

type RgbChannels = [number, number, number];

const APP_BRAND = APP_BRAND_DEFAULTS;

export type BrandingInput = Partial<Pick<AppSettings, "appName" | "appIcon" | "appBgColor" | "appMainColor" | "appLightColor">>;

export function normalizeHex(value?: string | null) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const normalized = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return `#${normalized.toLowerCase()}`;
}

function hexToRgb(hex: string): RgbChannels {
  const normalized = hex.replace("#", "");
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToChannels(rgb: RgbChannels): string {
  return `${rgb[0]} ${rgb[1]} ${rgb[2]}`;
}

function darkenRgb(rgb: RgbChannels, amount: number): RgbChannels {
  const factor = Math.max(0, Math.min(1, 1 - amount));
  return [
    Math.round(rgb[0] * factor),
    Math.round(rgb[1] * factor),
    Math.round(rgb[2] * factor),
  ];
}

export function buildAppConfig(input: BrandingInput = {}) {
  const name = input.appName?.trim() || APP_BRAND.name;
  const icon = resolveAppBrandIcon(input.appIcon);

  const bgHex = normalizeHex(input.appBgColor) ?? APP_BRAND.colors.bg;
  const mainHex = normalizeHex(input.appMainColor) ?? APP_BRAND.colors.main;
  const lightHex = normalizeHex(input.appLightColor) ?? APP_BRAND.colors.light;

  const bgRgb = hexToRgb(bgHex);
  const mainRgb = hexToRgb(mainHex);
  const lightRgb = hexToRgb(lightHex);
  const mainDarkRgb = darkenRgb(mainRgb, 0.15);
  const inkRgb = darkenRgb(mainRgb, 0.7);

  return {
    name,
    description: APP_BRAND.description,
    icon,
    colors: {
      bgHex,
      mainHex,
      lightHex,
      mainDarkHex: `#${mainDarkRgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
      inkHex: `#${inkRgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`,
    },
    cssVars: {
      "--app-bg": rgbToChannels(bgRgb),
      "--app-main": rgbToChannels(mainRgb),
      "--app-light": rgbToChannels(lightRgb),
      "--app-main-dark": rgbToChannels(mainDarkRgb),
      "--app-ink": rgbToChannels(inkRgb),
    } as Record<string, string>,
  };
}

export function getAppConfig() {
  return buildAppConfig();
}

export function getAppMetadata(config: ReturnType<typeof buildAppConfig>): Metadata {
  return {
    title: config.name,
    description: config.description,
    icons: config.icon ? { icon: config.icon } : undefined,
  };
}

export function getAppViewport(config: ReturnType<typeof buildAppConfig>): Viewport {
  return {
    themeColor: config.colors.mainHex,
  };
}
