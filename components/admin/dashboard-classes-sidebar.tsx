"use client";

import { MessageSquareText, MonitorPlay, Radio, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { ViewerQuestionSummary } from "@/lib/admin-data";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import { formatDateTime } from "@/lib/utils";

type ClassesEntry = { year: number; section: string; displayName?: string | null };
type ViewerCount = { year: number; section: string; count: number; ips: string[] };

function formatClassLabel(e: ClassesEntry) {
  return e.displayName ?? `${getYearLabel(e.year)}${e.section}`;
}

function sortClassEntries(a: ClassesEntry, b: ClassesEntry) {
  const ya = a.year === 0 ? 99 : a.year;
  const yb = b.year === 0 ? 99 : b.year;
  return ya !== yb ? ya - yb : a.section.localeCompare(b.section);
}

function formatVQLabel(e: ViewerQuestionSummary) {
  if (!e.classYear || !e.classSection) return "Pubblico";
  return `${getYearLabel(e.classYear)}${e.classSection}`;
}

export function DashboardClassesSidebar({
  initialClasses,
  initialViewerQuestions = [],
}: {
  initialClasses: ClassesEntry[];
  initialViewerQuestions?: ViewerQuestionSummary[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [viewerQuestions, setViewerQuestions] = useState(initialViewerQuestions);
  const [viewerCounts, setViewerCounts] = useState<ViewerCount[]>([]);

  useEffect(() => {
    const socket = getSocket();
    socket.on("viewer:count", (p: ViewerCount[]) => setViewerCounts(p));
    socket.on("classes:update", (p: ClassesEntry[]) => setClasses(p));
    socket.on("viewer-question:new", (p: ViewerQuestionSummary) =>
      setViewerQuestions((cur) => [p, ...cur.filter((e) => e.id !== p.id)].slice(0, 20)),
    );
    return () => {
      socket.off("viewer:count");
      socket.off("classes:update");
      socket.off("viewer-question:new");
    };
  }, []);

  const viewerMap = useMemo(() => {
    const m = new Map<string, ViewerCount>();
    viewerCounts.forEach((e) => m.set(`${e.year}-${e.section}`, e));
    return m;
  }, [viewerCounts]);

  const sorted = useMemo(() => [...classes].sort(sortClassEntries), [classes]);
  const connected = sorted.filter((e) => viewerMap.has(`${e.year}-${e.section}`));
  const disconnected = sorted.filter((e) => !viewerMap.has(`${e.year}-${e.section}`));

  async function sendViewerQuestionToEmbed(id: string) {
    await fetch("/api/admin/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "viewer-question", viewerQuestionId: id }),
    });
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Monitoraggio</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Connected classes */}
        <section className="p-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Radio className="h-3.5 w-3.5 text-success" />
            <p className="text-xs font-medium text-foreground">Online</p>
            <Badge variant="success" className="ml-auto">{connected.length}</Badge>
          </div>
          {connected.length ? (
            <div className="space-y-1">
              {connected.map((e) => {
                const key = `${e.year}-${e.section}`;
                const v = viewerMap.get(key);
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground">{formatClassLabel(e)}</p>
                      {v?.ips?.length ? (
                        <p className="text-[10px] text-muted truncate">{v.ips.join(" · ")}</p>
                      ) : null}
                    </div>
                    <span className="text-xs font-semibold text-foreground shrink-0">{v?.count ?? 0}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-1 text-xs text-muted">Nessuna classe connessa.</p>
          )}
        </section>

        {/* Disconnected classes */}
        <section className="p-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Users className="h-3.5 w-3.5 text-muted" />
            <p className="text-xs font-medium text-foreground">Offline</p>
            <Badge variant="secondary" className="ml-auto">{disconnected.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {disconnected.map((e) => (
              <span
                key={`${e.year}-${e.section}`}
                className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted"
              >
                {formatClassLabel(e)}
              </span>
            ))}
            {!disconnected.length && <p className="px-1 text-xs text-muted">Tutte connesse!</p>}
          </div>
        </section>

        {/* Viewer questions */}
        <section className="p-3 border-t border-border">
          <div className="flex items-center gap-2 mb-2 px-1">
            <MessageSquareText className="h-3.5 w-3.5 text-accent" />
            <p className="text-xs font-medium text-foreground">Dal pubblico</p>
            <Badge variant="default" className="ml-auto">{viewerQuestions.length}</Badge>
          </div>
          {viewerQuestions.length ? (
            <div className="space-y-1">
              {viewerQuestions.slice(0, 15).map((e) => (
                <div key={e.id} className="rounded-lg border border-border bg-surface p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-medium text-foreground">{formatVQLabel(e)}</span>
                    <span className="text-[10px] text-muted shrink-0">{formatDateTime(e.createdAt)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-foreground leading-relaxed flex-1">{e.text}</p>
                    <button
                      type="button"
                      onClick={() => void sendViewerQuestionToEmbed(e.id)}
                      title="Manda a embed"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-accent-subtle hover:text-accent"
                    >
                      <MonitorPlay className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-xs text-muted">Nessuna domanda ricevuta.</p>
          )}
        </section>
      </div>
    </div>
  );
}
