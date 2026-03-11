"use client";

import { useEffect } from "react";

import { buildAppConfig } from "@/lib/app-config";
import { getSocket } from "@/lib/socket-client";
import type { AppSettings } from "@/lib/settings";

function applySettings(settings: AppSettings) {
  const config = buildAppConfig(settings);
  const root = document.documentElement;

  Object.entries(config.cssVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  if (config.name) {
    document.title = config.name;
  }

  if (config.icon) {
    let icon = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = config.icon;
  }

  let themeColor = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (!themeColor) {
    themeColor = document.createElement("meta");
    themeColor.name = "theme-color";
    document.head.appendChild(themeColor);
  }
  themeColor.content = config.colors.mainHex;
}

export function ThemeSync({ initialSettings }: { initialSettings: AppSettings }) {
  useEffect(() => {
    applySettings(initialSettings);
    const socket = getSocket();
    const onUpdate = (payload: AppSettings) => applySettings(payload);
    socket.on("settings:update", onUpdate);

    return () => {
      socket.off("settings:update", onUpdate);
    };
  }, [initialSettings]);

  return null;
}
