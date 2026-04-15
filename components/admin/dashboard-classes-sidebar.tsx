"use client";

import { ChevronDown, ChevronRight, MessageSquareText, Radio, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import type { ViewerQuestionSummary } from "@/lib/admin-data";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import { formatDateTime } from "@/lib/utils";

type ClassesEntry = {
  year: number;
  section: string;
  displayName?: string | null;
};

type ViewerCount = {
  year: number;
  section: string;
  count: number;
  ips: string[];
};

const DEFAULT_DESKTOP_WIDTH = 320;
const MIN_DESKTOP_WIDTH = 260;
const MAX_DESKTOP_WIDTH = 440;

function formatClassLabel(entry: ClassesEntry) {
  return entry.displayName ?? `${getYearLabel(entry.year)}${entry.section}`;
}

function sortClassEntries(a: ClassesEntry, b: ClassesEntry) {
  const yearA = a.year === 0 ? 99 : a.year;
  const yearB = b.year === 0 ? 99 : b.year;
  if (yearA !== yearB) {
    return yearA - yearB;
  }
  return a.section.localeCompare(b.section);
}

function formatViewerQuestionClassLabel(entry: ViewerQuestionSummary) {
  if (entry.classYear === null || !entry.classSection) {
    return "Pubblico";
  }

  return `${getYearLabel(entry.classYear)}${entry.classSection}`;
}

export function DashboardClassesSidebar({
  initialClasses,
  initialViewerQuestions = [],
  mobile = false,
  desktopWidth: controlledDesktopWidth,
  desktopCollapsed: controlledDesktopCollapsed,
  onDesktopWidthPreview,
  onDesktopWidthChange,
  onDesktopCollapsedChange,
  onDesktopResizeStateChange,
}: {
  initialClasses: ClassesEntry[];
  initialViewerQuestions?: ViewerQuestionSummary[];
  mobile?: boolean;
  desktopWidth?: number;
  desktopCollapsed?: boolean;
  onDesktopWidthPreview?: (width: number) => void;
  onDesktopWidthChange?: (width: number) => void;
  onDesktopCollapsedChange?: (collapsed: boolean) => void;
  onDesktopResizeStateChange?: (isResizing: boolean) => void;
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [viewerQuestions, setViewerQuestions] = useState(initialViewerQuestions);
  const [viewerCounts, setViewerCounts] = useState<ViewerCount[]>([]);
  const [localDesktopWidth, setLocalDesktopWidth] = useState(controlledDesktopWidth ?? DEFAULT_DESKTOP_WIDTH);
  const [localDesktopCollapsed, setLocalDesktopCollapsed] = useState(false);
  const [onlineExpanded, setOnlineExpanded] = useState(true);
  const [offlineExpanded, setOfflineExpanded] = useState(true);
  const resizeActiveRef = useRef(false);
  const desktopWidthRef = useRef(DEFAULT_DESKTOP_WIDTH);
  const pendingWidthRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const desktopWidth = localDesktopWidth;
  const desktopCollapsed = controlledDesktopCollapsed ?? localDesktopCollapsed;
  const setDesktopWidth = onDesktopWidthChange ?? setLocalDesktopWidth;
  const setDesktopCollapsed = onDesktopCollapsedChange ?? setLocalDesktopCollapsed;

  useEffect(() => {
    const socket = getSocket();
    socket.on("viewer:count", (payload: ViewerCount[]) => setViewerCounts(payload));
    socket.on("classes:update", (payload: ClassesEntry[]) => setClasses(payload));
    socket.on("viewer-question:new", (payload: ViewerQuestionSummary) =>
      setViewerQuestions((current) => [payload, ...current.filter((entry) => entry.id !== payload.id)].slice(0, 20)),
    );

    return () => {
      socket.off("viewer:count");
      socket.off("classes:update");
      socket.off("viewer-question:new");
    };
  }, []);

  const viewerMap = useMemo(() => {
    const map = new Map<string, ViewerCount>();
    viewerCounts.forEach((entry) => map.set(`${entry.year}-${entry.section}`, entry));
    return map;
  }, [viewerCounts]);

  const sortedClasses = useMemo(() => [...classes].sort(sortClassEntries), [classes]);
  const disconnectedClasses = sortedClasses.filter((entry) => !viewerMap.has(`${entry.year}-${entry.section}`));
  const connectedClasses = sortedClasses.filter((entry) => viewerMap.has(`${entry.year}-${entry.section}`));
  const offlineColumns = mobile ? 3 : desktopWidth >= 400 ? 5 : desktopWidth >= 320 ? 4 : 3;
  const showInlineIps = mobile || desktopWidth >= 200;

  useEffect(() => {
    desktopWidthRef.current = desktopWidth;
  }, [desktopWidth]);

  useEffect(() => {
    if (typeof controlledDesktopWidth === "number" && !resizeActiveRef.current) {
      setLocalDesktopWidth(controlledDesktopWidth);
    }
  }, [controlledDesktopWidth]);

  useEffect(() => {
    if (mobile) {
      return;
    }

    const flushPendingWidth = () => {
      animationFrameRef.current = null;
      if (pendingWidthRef.current === null) {
        return;
      }

      const nextWidth = pendingWidthRef.current;
      pendingWidthRef.current = null;
      setLocalDesktopWidth(nextWidth);
      onDesktopWidthPreview?.(nextWidth);
    };

    const stopResize = () => {
      if (!resizeActiveRef.current) {
        return;
      }

      resizeActiveRef.current = false;
      onDesktopResizeStateChange?.(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        flushPendingWidth();
      }
      setDesktopWidth(desktopWidthRef.current);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeActiveRef.current) {
        return;
      }

      const nextWidth = Math.max(MIN_DESKTOP_WIDTH, Math.min(MAX_DESKTOP_WIDTH, window.innerWidth - event.clientX));
      setDesktopCollapsed(false);
      pendingWidthRef.current = nextWidth;
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame(flushPendingWidth);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      stopResize();
    };
  }, [mobile, onDesktopResizeStateChange, onDesktopWidthPreview, setDesktopCollapsed, setDesktopWidth]);

  function handleResizeStart(event: ReactPointerEvent<HTMLButtonElement>) {
    resizeActiveRef.current = true;
    onDesktopResizeStateChange?.(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  async function sendViewerQuestionToEmbed(viewerQuestionId: string) {
    await fetch("/api/admin/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        kind: "viewer-question",
        viewerQuestionId,
      }),
    });
  }

  const content = (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-sage/20 bg-sage/10 p-4">
        <button
          type="button"
          onClick={() => setOnlineExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-sage">
            <Radio className="h-4 w-4" />
            Online ({connectedClasses.length})
          </span>
          <ChevronDown className={`h-4 w-4 text-sage transition-transform ${onlineExpanded ? "" : "-rotate-90"}`} />
        </button>
        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${onlineExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-60"}`}>
          <div className="overflow-hidden">
            <div className="mt-3 space-y-2">
              {connectedClasses.length ? (
                connectedClasses.map((entry) => {
                  const key = `${entry.year}-${entry.section}`;
                  const viewer = viewerMap.get(key);
                  return (
                    <div key={key} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className={`flex min-w-0 gap-2 ${showInlineIps ? "items-center" : "flex-col"}`}>
                            <span className="shrink-0 text-sm font-medium text-ink">{formatClassLabel(entry)}</span>
                            {showInlineIps && viewer?.ips?.length ? (
                              <span className="truncate text-xs text-ink/50">{viewer.ips.join(" · ")}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-xs font-semibold text-ocean">
                          {viewer?.count ?? 0}
                        </span>
                      </div>
                      {!showInlineIps && viewer?.ips?.length ? <p className="mt-1 text-xs text-ink/50">{viewer.ips.join(" · ")}</p> : null}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-ink/60">Nessuna classe connessa.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-terracotta/15 bg-terracotta/5 p-4">
        <button
          type="button"
          onClick={() => setOfflineExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-terracotta">
            <Users className="h-4 w-4" />
            Offline ({disconnectedClasses.length})
          </span>
          <ChevronDown className={`h-4 w-4 text-terracotta transition-transform ${offlineExpanded ? "" : "-rotate-90"}`} />
        </button>
        <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${offlineExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-60"}`}>
          <div className="overflow-hidden">
            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${offlineColumns}, minmax(0, 1fr))` }}
            >
              {disconnectedClasses.length ? (
                disconnectedClasses.map((entry) => (
                  <div
                    key={`${entry.year}-${entry.section}`}
                    className="flex min-h-11 items-center justify-center rounded-2xl border border-white/80 bg-white px-2 py-2 text-center"
                  >
                    <span className="text-sm font-medium text-ink">{formatClassLabel(entry)}</span>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-sm text-ink/60">Nessuna classe scollegata.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-ocean/10 bg-ocean/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-ocean">
            <MessageSquareText className="h-4 w-4" />
            Dal pubblico
          </span>
          <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold text-ocean">{viewerQuestions.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {viewerQuestions.length ? (
            viewerQuestions.slice(0, 12).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/80 bg-white px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{formatViewerQuestionClassLabel(entry)}</p>
                  <p className="shrink-0 text-[11px] text-ink/45">{formatDateTime(entry.createdAt)}</p>
                </div>
                <p className="mt-1 text-sm leading-5 text-ink/80">{entry.text}</p>
                <button
                  type="button"
                  onClick={() => void sendViewerQuestionToEmbed(entry.id)}
                  className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-ocean"
                >
                  Mostra su embed
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink/60">Nessuna domanda dal pubblico ricevuta.</p>
          )}
        </div>
      </section>
    </div>
  );

  if (mobile) {
    return (
      <aside className="space-y-5 rounded-[28px] border border-ocean/10 bg-white/70 p-5 shadow-soft">
        <h2 className="text-xl font-semibold text-ink">Classi</h2>
        {content}
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full w-full flex-col border-l border-ocean/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(245,249,255,0.9))]">
      {!desktopCollapsed ? (
        <button
          type="button"
          onPointerDown={handleResizeStart}
          className="absolute inset-y-0 left-0 z-10 hidden w-3 -translate-x-1/2 cursor-col-resize xl:block"
          aria-label={`Ridimensiona pannello classi, larghezza attuale ${desktopWidth}px`}
        >
          <span className="absolute inset-y-6 left-1/2 w-px -translate-x-1/2 rounded-full bg-ocean/18" />
        </button>
      ) : null}

      <div className={`flex items-center border-b border-ocean/10 ${desktopCollapsed ? "justify-center px-2 py-3" : "justify-between px-5 py-4"}`}>
        {!desktopCollapsed ? <h2 className="text-xl font-semibold text-ink">Classi</h2> : null}
        <button
          type="button"
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ocean/10 bg-white/75 text-ocean transition-colors hover:bg-white"
          aria-label={desktopCollapsed ? "Espandi colonna classi" : "Comprimi colonna classi"}
        >
          <ChevronRight className={`h-5 w-5 transition-transform duration-300 ${desktopCollapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      {!desktopCollapsed ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{content}</div> : null}
    </aside>
  );
}
