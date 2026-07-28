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

// Applies the stored theme before the first paint. Without it the admin area
// renders one frame with the system theme and then switches, because the choice
// lives in localStorage and is only readable after hydration. With no stored
// choice nothing is added and the CSS `prefers-color-scheme` rule decides.
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("theme");var r=document.documentElement;r.classList.remove("light","dark");if(t==="light"||t==="dark")r.classList.add(t)}catch(e){}`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
