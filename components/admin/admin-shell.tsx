"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "streams" | "settings";

const DEFAULT_SIDEBAR_WIDTH = 320;
const COLLAPSED_SIDEBAR_WIDTH = 72;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 440;
const SIDEBAR_WIDTH_COOKIE = "admin_sidebar_width";
const SIDEBAR_COLLAPSED_COOKIE = "admin_sidebar_collapsed";

function clampSidebarWidth(width: number) {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width));
}

export function AdminShell({
  appName,
  appIcon,
  active,
  sidebar,
  contentClassName,
  initialSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  initialSidebarCollapsed = false,
  children,
}: Readonly<{
  appName: string;
  appIcon?: string | null;
  active: NavKey;
  sidebar?: ReactNode;
  contentClassName?: string;
  initialSidebarWidth?: number;
  initialSidebarCollapsed?: boolean;
  children: ReactNode;
}>) {
  const [branding, setBranding] = useState({
    name: appName,
    icon: appIcon,
  });
  const mainRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(() => clampSidebarWidth(initialSidebarWidth));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);
  const [sidebarResizing, setSidebarResizing] = useState(false);

  useEffect(() => {
    setBranding({ name: appName, icon: appIcon });
  }, [appName, appIcon]);

  useEffect(() => {
    const socket = getSocket();
    const onUpdate = (payload: { appName: string; appIcon: string | null }) => {
      setBranding({ name: payload.appName, icon: payload.appIcon });
    };

    socket.on("settings:update", onUpdate);

    return () => {
      socket.off("settings:update", onUpdate);
    };
  }, []);

  const desktopSidebarWidth = sidebar ? (sidebarCollapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth) : 0;
  const layoutStyle = {
    "--admin-sidebar-width": `${desktopSidebarWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!sidebar) {
      return;
    }

    document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${sidebarWidth}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${sidebarCollapsed ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [sidebar, sidebarCollapsed, sidebarWidth]);

  const handleDesktopWidthPreview = useCallback((nextWidth: number) => {
    mainRef.current?.style.setProperty("--admin-sidebar-width", `${nextWidth}px`);
  }, []);

  const sidebarNode =
    sidebar && isValidElement(sidebar)
      ? cloneElement(sidebar as ReactElement<Record<string, unknown>>, {
          desktopWidth: sidebarWidth,
          desktopCollapsed: sidebarCollapsed,
          onDesktopWidthPreview: handleDesktopWidthPreview,
          onDesktopWidthChange: setSidebarWidth,
          onDesktopCollapsedChange: setSidebarCollapsed,
          onDesktopResizeStateChange: setSidebarResizing,
        })
      : sidebar;

  return (
    <main
      ref={mainRef}
      className="min-h-screen bg-[linear-gradient(180deg,rgb(var(--app-bg))_0%,rgb(var(--app-bg)/0.96)_100%)]"
      style={layoutStyle}
    >
      <header className="fixed inset-x-0 top-0 z-40 border-b border-ocean/10 bg-white/90 backdrop-blur">
        <div className="flex h-16 w-full items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              {branding.icon ? (
                <Image
                  src={branding.icon}
                  alt={branding.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean/10 text-xs font-semibold text-ocean">
                  {branding.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-base font-semibold text-ink">{branding.name}</span>
            </Link>
            <nav className="ml-6 flex items-center gap-4 text-sm font-semibold text-ink/65">
              <Link
                href="/admin/dashboard"
                className={cn(
                  "border-b-2 border-transparent pb-1 transition-colors hover:text-ink",
                  active === "dashboard" && "border-ocean text-ink",
                )}
              >
                Dashboard
              </Link>
              <Link
                href="/admin/streams"
                className={cn(
                  "border-b-2 border-transparent pb-1 transition-colors hover:text-ink",
                  active === "streams" && "border-ocean text-ink",
                )}
              >
                Stream
              </Link>
              <Link
                href="/admin/classes"
                className={cn(
                  "border-b-2 border-transparent pb-1 transition-colors hover:text-ink",
                  active === "settings" && "border-ocean text-ink",
                )}
              >
                Impostazioni
              </Link>
            </nav>
          </div>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="ghost" className="px-4 py-2">
              Logout
            </Button>
          </form>
        </div>
      </header>
      <div
        className={cn(
          "w-full pb-10 pt-24",
          sidebar && "xl:pr-[var(--admin-sidebar-width)]",
          !sidebarResizing && "transition-[padding-right] duration-300",
        )}
      >
        <div className={cn("mx-auto w-full max-w-[1600px] px-6", contentClassName)}>{children}</div>
      </div>
      {sidebar ? (
        <div
          className={cn(
            "pointer-events-none fixed bottom-0 right-0 top-16 z-30 hidden xl:block",
            !sidebarResizing && "transition-[width] duration-300",
          )}
          style={{ width: "var(--admin-sidebar-width)" }}
        >
          <div className="h-full pointer-events-auto">{sidebarNode}</div>
        </div>
      ) : null}
    </main>
  );
}
