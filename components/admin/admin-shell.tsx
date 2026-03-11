import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function AdminShell({
  title,
  subtitle,
  children,
}: Readonly<{
  title: string;
  subtitle?: string;
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgb(var(--app-bg))_0%,rgb(var(--app-bg)/0.94)_100%)] px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 rounded-[28px] border border-ocean/10 bg-white/80 p-6 shadow-soft lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-ocean/70">Pannello tecnico</p>
            <h1 className="text-4xl font-semibold">{title}</h1>
            {subtitle ? <p className="mt-2 text-ink/65">{subtitle}</p> : null}
          </div>
          <nav className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/admin/dashboard">Dashboard</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/streams">Stream</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/classes">Impostazioni</Link>
            </Button>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost">
                Esci
              </Button>
            </form>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}
