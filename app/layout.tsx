import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import "@/app/globals.css";

import { buildAppConfig, getAppMetadata, getAppViewport } from "@/lib/app-config";
import { ThemeSync } from "@/components/theme-sync";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  const appConfig = buildAppConfig(settings);
  return getAppMetadata(appConfig);
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getAppSettings();
  const appConfig = buildAppConfig(settings);
  return getAppViewport(appConfig);
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const settings = await getAppSettings();
  const appConfig = buildAppConfig(settings);

  return (
    <html lang="it" style={appConfig.cssVars as CSSProperties}>
      <body>
        <ThemeSync initialSettings={settings} />
        {children}
      </body>
    </html>
  );
}
