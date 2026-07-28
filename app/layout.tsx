import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@/app/globals.css";

import { buildAppConfig, getAppMetadata, getAppViewport } from "@/lib/app-config";
import { getAppSettings } from "@/lib/settings";

// Self-hosted at build time: no runtime request to fonts.googleapis.com from
// student devices, and no flash of unstyled text.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="it" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
