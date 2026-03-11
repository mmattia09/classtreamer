import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavKey = "dashboard" | "streams" | "settings";

export function AdminShell({
  appName,
  appIcon,
  active,
  children,
}: Readonly<{
  appName: string;
  appIcon?: string | null;
  active: NavKey;
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgb(var(--app-bg))_0%,rgb(var(--app-bg)/0.96)_100%)]">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-ocean/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {appIcon ? (
                <Image
                  src={appIcon}
                  alt={appName}
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean/10 text-xs font-semibold text-ocean">
                  {appName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-base font-semibold text-ink">{appName}</span>
            </div>
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
      <div className="mx-auto w-full max-w-[1600px] px-6 pb-10 pt-24">{children}</div>
    </main>
  );
}
