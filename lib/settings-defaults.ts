export const APP_BRAND_DEFAULT_ICON = "/logo.png";

export function resolveAppBrandIcon(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return APP_BRAND_DEFAULT_ICON;
  }
  return trimmed;
}

export const APP_BRAND_DEFAULTS = {
  name: "Classtreamer",
  description: "Gestione stream scolastiche con interazione in tempo reale",
  icon: APP_BRAND_DEFAULT_ICON,
} as const;
