"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ClassEntry, getYearLabel, groupClassesByYear } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import { cn } from "@/lib/utils";

type SettingsPayload = {
  appName: string;
  appIcon: string;
  appBgColor: string;
  appMainColor: string;
  appLightColor: string;
};

type Props = {
  initialClasses: ClassEntry[];
  initialSettings: SettingsPayload;
  appName: string;
  appIcon: string | null;
};

export function ClassSelection({ initialClasses, initialSettings: _initialSettings, appName, appIcon }: Props) {
  const [classes, setClasses] = useState<ClassEntry[]>(initialClasses);
  const [branding, setBranding] = useState({ name: appName, icon: appIcon });
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on("classes:update", (payload: ClassEntry[]) => setClasses(payload));
    socket.on("settings:update", (payload: SettingsPayload) => {
      setBranding({ name: payload.appName, icon: payload.appIcon });
    });

    return () => {
      socket.off("classes:update");
      socket.off("settings:update");
    };
  }, []);

  const grouped = useMemo(() => groupClassesByYear(classes), [classes]);

  useEffect(() => {
    if (selectedYear !== null && !grouped.has(selectedYear)) {
      setSelectedYear(null);
    }
  }, [grouped, selectedYear]);
  const years = useMemo(() => {
    const entries = Array.from(grouped.keys());
    return entries.sort((a, b) => {
      if (a === 0 && b !== 0) {
        return 1;
      }
      if (b === 0 && a !== 0) {
        return -1;
      }
      return a - b;
    });
  }, [grouped]);

  const sectionsForYear = selectedYear !== null ? grouped.get(selectedYear) ?? [] : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <div className="flex-1 space-y-8">
        <header className="flex flex-col items-center gap-4 text-center">
          {branding.icon ? (
            <Image
              src={branding.icon}
              alt={`Logo ${branding.name}`}
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-2xl object-contain shadow-soft"
            />
          ) : null}
          <div>
            <p className="text-sm uppercase tracking-[0.26em] text-ocean/70">Benvenuti su</p>
            <h1 className="text-4xl font-semibold">{branding.name}</h1>
          </div>
        </header>

        <Card className="space-y-8">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Classe</p>
            <h2 className="text-3xl font-semibold">Seleziona l&apos;anno</h2>
          </div>
          {years.length === 0 ? (
            <p className="text-ink/70">Nessuna classe configurata al momento.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-5">
              {years.map((year) => {
                const active = selectedYear === year;
                return (
                  <Button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={cn("h-20 text-3xl", active && "ring-2 ring-ocean/40")}
                  >
                    {getYearLabel(year)}
                  </Button>
                );
              })}
            </div>
          )}

          <div
            className={cn(
              "grid gap-4 overflow-hidden transition-all duration-300",
              selectedYear !== null ? "max-h-[480px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
            )}
          >
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">
                Sezione {selectedYear !== null ? getYearLabel(selectedYear) : ""}
              </p>
              <h3 className="text-2xl font-semibold">Seleziona la sezione</h3>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {sectionsForYear.map((entry) => {
                const href = `/class/${entry.year}/${encodeURIComponent(entry.section)}`;
                return (
                  <Button key={`${entry.year}-${entry.section}`} asChild className="h-20 text-2xl">
                    <Link href={href}>{entry.displayName ?? entry.section}</Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      <div className="pt-8 text-center">
        <Link href="/admin" className="text-sm font-semibold text-ocean">
          → Sono un Tecnico
        </Link>
      </div>
    </main>
  );
}
