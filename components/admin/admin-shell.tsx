"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LayoutDashboard, Radio, Settings, LogOut, Moon, Sun, Monitor, ExternalLink } from "lucide-react";

import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "streams" | "settings";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { key: "streams", label: "Stream", href: "/admin/streams", icon: Radio },
  { key: "settings", label: "Impostazioni", href: "/admin/classes", icon: Settings },
];

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "theme";
const THEME_EVENT = "classtreamer:theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme === "light") root.classList.add("light");
  if (theme === "dark") root.classList.add("dark");
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  // Keep tabs in sync when the choice is changed in another one.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/**
 * Reads the stored preference through useSyncExternalStore rather than through
 * a setState inside an effect, which rendered one frame with the wrong icon.
 * The class itself is applied before paint by the inline script in app/layout.tsx,
 * so there is no flash of the wrong theme.
 */
function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, readStoredTheme, () => "system" as Theme);

  function setTheme(next: Theme) {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return { theme, setTheme };
}

function ThemeCycleButton() {
  const { theme, setTheme } = useTheme();

  const cycles: Theme[] = ["light", "dark", "system"];
  const next = cycles[(cycles.indexOf(theme) + 1) % cycles.length];
  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[theme];

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
      aria-label="Cambia tema"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function AdminShell({
  appName,
  appIcon,
  active,
  rightPanel,
  rightPanelWidth = 320,
  children,
}: Readonly<{
  appName: string;
  appIcon?: string | null;
  active: NavKey;
  rightPanel?: ReactNode;
  rightPanelWidth?: number;
  children: ReactNode;
}>) {
  // Null until a live settings:update arrives; until then the server-rendered
  // props are used directly, so a navigation that brings fresher props is not
  // shadowed by stale state.
  const [liveBranding, setLiveBranding] = useState<{ name: string; icon: string | null } | null>(
    null,
  );
  const branding = liveBranding ?? { name: appName, icon: appIcon ?? null };

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (payload: { appName: string; appIcon: string | null }) => {
      setLiveBranding({ name: payload.appName, icon: payload.appIcon });
    };
    socket.on("settings:update", onUpdate);
    return () => { socket.off("settings:update", onUpdate); };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Left sidebar ── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[220px] flex-col border-r border-border bg-surface">
        {/* Logo */}
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2.5 px-4 py-4 transition-opacity hover:opacity-80"
        >
          {branding.icon ? (
            <Image
              src={branding.icon}
              alt={branding.name}
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-[11px] font-bold text-accent-foreground">
              {branding.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-semibold text-foreground truncate">{branding.name}</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                active === key
                  ? "bg-accent-subtle text-accent font-medium"
                  : "text-muted hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom: home preview + theme + logout */}
        <div className="border-t border-border px-2 py-3 space-y-1">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            Home studenti
          </a>
          <div className="flex items-center justify-between px-1">
            <ThemeCycleButton />
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        className={cn(
          "flex min-h-screen flex-1 flex-col",
          "pl-[220px]",
          rightPanel && "pr-[var(--right-panel-width)]",
        )}
        style={rightPanel ? ({ "--right-panel-width": `${rightPanelWidth}px` } as React.CSSProperties) : undefined}
      >
        <div className="flex-1 p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* ── Right panel ── */}
      {rightPanel ? (
        <aside
          className="fixed inset-y-0 right-0 z-30 flex flex-col border-l border-border bg-surface"
          style={{ width: rightPanelWidth }}
        >
          {rightPanel}
        </aside>
      ) : null}
    </div>
  );
}
