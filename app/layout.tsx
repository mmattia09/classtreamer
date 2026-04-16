import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";

import { buildAppConfig, getAppMetadata, getAppViewport } from "@/lib/app-config";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();
  return getAppMetadata(buildAppConfig(settings));
}

export async function generateViewport(): Promise<Viewport> {
  return getAppViewport();
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
