"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type ClassEntry, getYearLabel, groupClassesByYear } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

type Props = {
  initialClasses: ClassEntry[];
  initialSettings: { appName: string; appIcon: string };
  appName: string;
  appIcon: string | null;
  isAdmin?: boolean;
};

export function ClassSelection({ initialClasses, appName, appIcon, isAdmin }: Props) {
  const [classes, setClasses] = useState<ClassEntry[]>(initialClasses);
  const [branding, setBranding] = useState({ name: appName, icon: appIcon });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("classes:update", (p: ClassEntry[]) => setClasses(p));
    socket.on("settings:update", (p: { appName: string; appIcon: string }) => {
      setBranding({ name: p.appName, icon: p.appIcon });
    });
    return () => {
      socket.off("classes:update");
      socket.off("settings:update");
    };
  }, []);

  const grouped = useMemo(() => groupClassesByYear(classes), [classes]);
  const years = useMemo(
    () =>
      Array.from(grouped.keys()).sort((a, b) => {
        if (a === 0 && b !== 0) return 1;
        if (b === 0 && a !== 0) return -1;
        return a - b;
      }),
    [grouped],
  );

  useEffect(() => {
    if (selectedYear !== null && !grouped.has(selectedYear)) setSelectedYear(null);
  }, [grouped, selectedYear]);

  const sectionsForYear = selectedYear !== null ? (grouped.get(selectedYear) ?? []) : [];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16">
      {/* ── Centered main content ── */}
      <div className="w-full max-w-xl">
        {/* Logo + name */}
        <div className="mb-10 flex flex-col items-center gap-4 text-center">
          {branding.icon ? (
            <Image
              src={branding.icon}
              alt={branding.name}
              width={80}
              height={80}
              className="h-20 w-20 object-contain"
              unoptimized
            />
          ) : (
            <span className="text-5xl font-bold text-accent">
              {branding.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{branding.name}</h1>
            <p className="mt-1.5 text-base text-muted">Seleziona la tua classe per partecipare</p>
          </div>
        </div>

        {years.length === 0 ? (
          <p className="text-center text-sm text-muted">Nessuna classe configurata.</p>
        ) : (
          <div className="space-y-0">
            {/* ── Year picker ── */}
            <div>
              <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-muted">
                Anno
              </p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(selectedYear === year ? null : year)}
                    className={cn(
                      "flex h-16 w-[calc(20%-0.5rem)] min-w-[4.5rem] items-center justify-center rounded-2xl border-2 text-xl font-bold transition-all duration-150 active:scale-95 select-none",
                      selectedYear === year
                        ? "border-accent bg-accent text-accent-foreground shadow-md"
                        : "border-border bg-surface text-foreground hover:border-accent/40 hover:bg-surface-raised",
                    )}
                  >
                    {getYearLabel(year)}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Divider + section picker ── */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-1000 ease-out",
                selectedYear !== null ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 pointer-events-none",
              )}
            >
              <div className="my-5 flex items-center gap-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-widest text-muted">Sezione</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="flex flex-wrap justify-center gap-2.5">
                {sectionsForYear.map((entry) => (
                  <Link
                    key={`${entry.year}-${entry.section}`}
                    href={`/class/${entry.year}/${encodeURIComponent(entry.section)}`}
                    className="flex h-16 w-[calc(25%-0.5rem)] min-w-[4.5rem] items-center justify-center rounded-2xl border-2 border-border bg-surface text-xl font-bold text-foreground transition-all duration-150 hover:border-accent hover:bg-accent hover:text-accent-foreground active:scale-95 select-none"
                  >
                    {entry.displayName ?? entry.section}
                  </Link>
                ))}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom link — fixed center ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        {isAdmin ? (
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/admin/dashboard"
              className="font-medium text-muted/70 transition-colors hover:text-foreground"
            >
              Visita dashboard
            </Link>
            <span className="text-border">·</span>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="font-medium text-muted/70 transition-colors hover:text-foreground"
              >
                Esci
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/admin"
            className="text-xs font-medium text-muted/50 transition-colors hover:text-muted"
          >
            → Accesso amministratore
          </Link>
        )}
      </div>
    </div>
  );
}
