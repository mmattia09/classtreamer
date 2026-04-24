"use client";

import Link from "next/link";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  List,
  MonitorPlay,
  MonitorX,
  Play,
  Plus,
  Radio,
  SendHorizontal,
  Square,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScaleChart } from "@/components/results-view";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { CurrentStreamSummary, QuestionArchiveEntry, StreamSummary } from "@/lib/admin-data";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse, ViewerQuestionPayload } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

/* ─── Constants ─────────────────────────────────────────────────── */

const INPUT_TYPE_LABELS: Record<string, string> = {
  OPEN: "Aperta",
  WORD_COUNT: "Word cloud",
  SCALE: "Scala",
  SINGLE_CHOICE: "Singola",
  MULTIPLE_CHOICE: "Multipla",
};
const AUDIENCE_TYPE_LABELS: Record<string, string> = {
  CLASS: "Classe",
  INDIVIDUAL: "Individuale",
};

/* ─── Types ─────────────────────────────────────────────────────── */

type OverviewPayload = {
  streamStatus: StreamStatusResponse;
  activeQuestion: QuestionPayload | null;
  results: ResultsPayload | null;
  currentStream: CurrentStreamSummary | null;
  streams: { upcoming: StreamSummary[]; past: StreamSummary[]; drafts: StreamSummary[] };
  questionArchive: QuestionArchiveEntry[];
  viewerQuestions: ViewerQuestionPayload[];
};

type QuestionDraft = {
  text: string;
  inputType: string;
  audienceType: string;
  timerSeconds: number;
  options: string;
  settings: { min: number; max: number; step: number; maxWords: number };
};

type Notification = {
  id: number;
  title: string;
  description?: string;
  tone: "info" | "success" | "warning";
};

/* ─── Helpers ───────────────────────────────────────────────────── */

function formatViewerQuestionClassLabel(entry: ViewerQuestionPayload) {
  if (!entry.classYear || !entry.classSection) return "Pubblico";
  return `${getYearLabel(entry.classYear)}${entry.classSection}`;
}

function formatLiveElapsed(startedAt: string | null | undefined, now: number) {
  if (!startedAt) return "00:00";
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function isQuestionExpiredAt(
  q: Pick<QuestionPayload, "openedAt" | "timerSeconds"> | null | undefined,
  now: number,
) {
  if (!q?.openedAt || !q.timerSeconds) return false;
  return new Date(q.openedAt).getTime() + q.timerSeconds * 1000 <= now;
}

function formatTimerRemaining(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatQuestionMeta(inputType: string, audienceType?: string) {
  const inputLabel = INPUT_TYPE_LABELS[inputType] ?? inputType;
  if (!audienceType) return inputLabel;
  return `${inputLabel} · ${AUDIENCE_TYPE_LABELS[audienceType] ?? audienceType}`;
}

/* ─── Sub-components ────────────────────────────────────────────── */

function LivePill({ status, startedAt }: { status: StreamStatusResponse["status"]; startedAt?: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (status !== "live" || !startedAt) { setNow(null); return; }
    setNow(Date.now());
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [startedAt, status]);

  if (status === "live") {
    return (
      <Badge variant="live" className="gap-1.5 tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Live{now !== null && startedAt ? ` · ${formatLiveElapsed(startedAt, now)}` : ""}
      </Badge>
    );
  }
  if (status === "scheduled") return <Badge variant="warning">Programmata</Badge>;
  return <Badge variant="secondary">Offline</Badge>;
}

/** Mini bar-chart row */
function EntryBar({ label, value, total, max }: { label: string; value: number; total: number; max: number }) {
  const widthPct = max > 0 ? Math.round((value / max) * 100) : 0;
  const sharePct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="max-w-[55%] truncate text-xs text-foreground">{label}</span>
        <span className="shrink-0 text-xs text-muted">{value} <span className="text-muted/60">({sharePct}%)</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

/** Results panel body — no header, just data */
function ResultsBody({
  results,
  embedSelectionIds,
  featuredEmbedAnswerId,
  onEmbedSelectionChange,
  onFeaturedChange,
}: {
  results: ResultsPayload;
  embedSelectionIds: string[];
  featuredEmbedAnswerId: string | null;
  onEmbedSelectionChange: (ids: string[]) => void;
  onFeaturedChange: (id: string | null) => void;
}) {
  const hasEntries = results.entries.length > 0;
  const hasSubmissions = (results.latestSubmissions?.length ?? 0) > 0;

  if (hasEntries) {
    const maxVal = Math.max(...results.entries.map((e) => e.value), 1);

    // Compute mean for SCALE
    let mean: number | null = null;
    if (results.type === "SCALE") {
      const totalWeight = results.entries.reduce((s, e) => s + e.value, 0);
      if (totalWeight > 0) {
        mean = results.entries.reduce((s, e) => s + Number(e.label) * e.value, 0) / totalWeight;
      }
    }

    if (results.type === "SCALE") {
      const scaleMin = results.scale?.min ?? 1;
      const scaleMax = results.scale?.max ?? 5;
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ScaleChart
            entries={results.entries}
            average={mean}
            scaleMin={scaleMin}
            scaleMax={scaleMax}
            dark={false}
          />
          <p className="mt-3 text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="space-y-2.5">
          {results.entries.map((e) => (
            <EntryBar key={e.label} label={e.label} value={e.value} total={results.totalAnswers} max={maxVal} />
          ))}
        </div>
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  if (hasSubmissions) {
    const isOpen = ["OPEN", "WORD_COUNT"].includes(results.type);
    return (
      <div className="space-y-1.5">
        {results.latestSubmissions!.slice(0, 20).map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{entry.value || "—"}</p>
              {entry.classLabel && <p className="text-[11px] text-muted">{entry.classLabel}</p>}
            </div>
            {isOpen && (
              <div className="flex shrink-0 items-center gap-2">
                <label title="Includi nell'embed" className="flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={embedSelectionIds.includes(entry.id)}
                    onChange={(e) =>
                      onEmbedSelectionChange(
                        e.target.checked ? [...embedSelectionIds, entry.id] : embedSelectionIds.filter((id) => id !== entry.id),
                      )
                    }
                  />
                  Embed
                </label>
                {results.type === "OPEN" && (
                  <label title="In primo piano" className="flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                    <input
                      type="radio"
                      name="featured-answer"
                      checked={featuredEmbedAnswerId === entry.id}
                      onChange={() => onFeaturedChange(entry.id)}
                    />
                    Featured
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  return <p className="text-sm text-muted">Nessuna risposta ancora.</p>;
}

/* ─── Main component ────────────────────────────────────────────── */

export function AdminOverview({ initialOverview }: { initialOverview: OverviewPayload }) {
  const [streamStatus, setStreamStatus] = useState(initialOverview.streamStatus);
  const [currentStream, setCurrentStream] = useState(initialOverview.currentStream);
  const [streams, setStreams] = useState(initialOverview.streams);
  const [questionArchive, setQuestionArchive] = useState(initialOverview.questionArchive);
  const [activeQuestion, setActiveQuestion] = useState(initialOverview.activeQuestion);
  const [results, setResults] = useState(initialOverview.results);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialOverview.activeQuestion?.id ?? null,
  );
  const [selectedResults, setSelectedResults] = useState<ResultsPayload | null>(initialOverview.results);
  const [error, setError] = useState("");
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({
    text: "",
    inputType: "OPEN",
    audienceType: "CLASS",
    timerSeconds: 60,
    options: "",
    settings: { min: 1, max: 10, step: 1, maxWords: 3 },
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selectedResultsLoading, setSelectedResultsLoading] = useState(false);
  const [embedSelectionIds, setEmbedSelectionIds] = useState<string[]>([]);
  const [featuredEmbedAnswerId, setFeaturedEmbedAnswerId] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState(0);
  const [clockNow, setClockNow] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [archiveSidebarWidth, setArchiveSidebarWidth] = useState(320);
  const [isResizingArchive, setIsResizingArchive] = useState(false);
  const [currentSectionOpen, setCurrentSectionOpen] = useState(true);
  const [pastSectionOpen, setPastSectionOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Embed state tracking
  const [embedQuestionId, setEmbedQuestionId] = useState<string | null>(null);

  const selectedQuestionRef = useRef(selectedQuestionId);
  const embedQuestionIdRef = useRef(embedQuestionId);
  const embedSelectionIdsRef = useRef(embedSelectionIds);
  const featuredEmbedAnswerIdRef = useRef(featuredEmbedAnswerId);
  const notificationIdRef = useRef(0);
  const notificationTimeoutsRef = useRef<number[]>([]);
  const resultsCacheRef = useRef(
    new Map<string, ResultsPayload>(
      initialOverview.results ? [[initialOverview.results.questionId, initialOverview.results]] : [],
    ),
  );
  const archiveSplitRef = useRef<HTMLDivElement>(null);

  useEffect(() => { selectedQuestionRef.current = selectedQuestionId; }, [selectedQuestionId]);
  useEffect(() => { embedQuestionIdRef.current = embedQuestionId; }, [embedQuestionId]);
  useEffect(() => { embedSelectionIdsRef.current = embedSelectionIds; }, [embedSelectionIds]);
  useEffect(() => { featuredEmbedAnswerIdRef.current = featuredEmbedAnswerId; }, [featuredEmbedAnswerId]);

  useEffect(() => {
    setClockNow(Date.now());
    const iv = window.setInterval(() => setTimerTick((n) => n + 1), 1000);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    if (timerTick === 0) return;
    setClockNow(Date.now());
  }, [timerTick]);

  useEffect(() => {
    if (!isResizingArchive) return;

    function handleMouseMove(event: MouseEvent) {
      const bounds = archiveSplitRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const separatorWidth = 8;
      const nextWidth = Math.min(440, Math.max(240, event.clientX - bounds.left - separatorWidth / 2));
      setArchiveSidebarWidth(nextWidth);
    }

    function handleMouseUp() {
      setIsResizingArchive(false);
    }

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingArchive]);

  function pushNotification(title: string, description: string | undefined, tone: Notification["tone"]) {
    const id = ++notificationIdRef.current;
    setNotifications((cur) => [...cur, { id, title, description, tone }].slice(-4));
    const t = window.setTimeout(() => {
      setNotifications((cur) => cur.filter((n) => n.id !== id));
      notificationTimeoutsRef.current = notificationTimeoutsRef.current.filter((x) => x !== t);
    }, 4500);
    notificationTimeoutsRef.current.push(t);
  }

  async function refreshOverview() {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!res.ok) return;
    const payload = (await res.json()) as OverviewPayload;
    startTransition(() => {
      setStreamStatus(payload.streamStatus);
      setCurrentStream(payload.currentStream);
      setStreams(payload.streams);
      setQuestionArchive(payload.questionArchive);
      setActiveQuestion(payload.activeQuestion);
      setResults(payload.results);
      if (payload.results) resultsCacheRef.current.set(payload.results.questionId, payload.results);
    });
  }

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join");

    socket.on("viewer-question:new", (p: ViewerQuestionPayload) =>
      pushNotification("Domanda dal pubblico", `${formatViewerQuestionClassLabel(p)} · ${p.text}`, "info"),
    );
    socket.on("results:update", (p: ResultsPayload) => {
      resultsCacheRef.current.set(p.questionId, p);
      setResults(p);
      if (selectedQuestionRef.current === p.questionId) setSelectedResults(p);
      pushNotification("Risposte aggiornate", undefined, "success");
      // Always auto-push when embed is active for this question
      if (embedQuestionIdRef.current === p.questionId) {
        void fetch("/api/admin/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "question",
            questionId: p.questionId,
            selectedAnswerIds: ["OPEN", "WORD_COUNT"].includes(p.type) ? embedSelectionIdsRef.current : undefined,
            featuredAnswerId: p.type === "OPEN" ? featuredEmbedAnswerIdRef.current : null,
          }),
        });
      }
    });
    socket.on("question:push", (p: QuestionPayload) => {
      setActiveQuestion(p);
      if (!selectedQuestionRef.current) setSelectedQuestionId(p.id);
      pushNotification("Domanda live", p.text, "success");
      void refreshOverview();
    });
    socket.on("question:close", () => {
      setActiveQuestion(null);
      pushNotification("Domanda chiusa", undefined, "warning");
      void refreshOverview();
    });
    socket.on("stream:status", (p: StreamStatusResponse) => {
      setStreamStatus(p);
      if (p.status === "live") pushNotification("Live in onda", (p as { title?: string }).title, "success");
      else if (p.status === "scheduled") pushNotification("Live programmata", undefined, "info");
      else pushNotification("Live terminata", undefined, "warning");
      void refreshOverview();
    });

    return () => {
      socket.off("viewer-question:new");
      socket.off("results:update");
      socket.off("question:push");
      socket.off("question:close");
      socket.off("stream:status");
    };
  }, []); // intentional: socket setup only on mount

  useEffect(() => {
    return () => { notificationTimeoutsRef.current.forEach(window.clearTimeout); };
  }, []);

  useEffect(() => {
    const iv = setInterval(refreshOverview, 12000);
    return () => clearInterval(iv);
  }, []); // intentional: polling setup only on mount

  useEffect(() => {
    if (!selectedQuestionId) { setSelectedResults(null); setSelectedResultsLoading(false); return; }
    if (results?.questionId === selectedQuestionId) {
      resultsCacheRef.current.set(results.questionId, results);
      setSelectedResults(results);
      setSelectedResultsLoading(false);
      return;
    }
    const cached = resultsCacheRef.current.get(selectedQuestionId);
    if (cached) { setSelectedResults(cached); setSelectedResultsLoading(false); return; }

    const ctrl = new AbortController();
    const reqId = selectedQuestionId;
    setSelectedResultsLoading(true);
    void fetch(`/api/admin/questions/${selectedQuestionId}/summary`, { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (p?.results) {
          const r = p.results as ResultsPayload;
          resultsCacheRef.current.set(r.questionId, r);
          if (selectedQuestionRef.current === reqId) setSelectedResults(r);
        }
      })
      .finally(() => { if (selectedQuestionRef.current === reqId) setSelectedResultsLoading(false); })
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [selectedQuestionId, results, results?.questionId]);

  // Default embedSelectionIds: start empty, don't pre-select
  useEffect(() => {
    setEmbedSelectionIds([]);
    setFeaturedEmbedAnswerId(null);
  }, [selectedQuestionId, selectedResults]);

  /* ── Derived state ── */
  const liveStream = streamStatus.status === "live" ? streamStatus : null;
  const scheduledStream = streamStatus.status === "scheduled" ? streamStatus : null;
  const streamPreviewUrl = liveStream?.embedUrl ?? scheduledStream?.embedUrl ?? currentStream?.embedUrl ?? null;
  const streamEditorId = liveStream?.streamId ?? scheduledStream?.streamId ?? currentStream?.id ?? streams.drafts[0]?.id ?? null;
  const streamDisplayTitle = liveStream?.title ?? scheduledStream?.title ?? currentStream?.title ?? null;
  const deskActiveQuestion = activeQuestion && (clockNow === null || !isQuestionExpiredAt(activeQuestion, clockNow))
    ? activeQuestion
    : null;
  const scheduledQuestions = currentStream?.questions.filter((q) => q.status === "DRAFT") ?? [];
  const nextQuestion = scheduledQuestions[0] ?? null;
  const archivedQuestions = questionArchive.filter(q => q.status === "LIVE" || q.answerCount > 0).slice(0, 16);
  const currentArchiveQuestions = archivedQuestions.filter((q) => q.streamId === currentStream?.id);
  const pastArchiveQuestions = archivedQuestions.filter((q) => q.streamId !== currentStream?.id);
  const recentStreams = [...streams.upcoming, ...streams.past].slice(0, 4);
  const selectedQuestionArchiveEntry = questionArchive.find((q) => q.id === selectedQuestionId) ?? null;
  const selectedQuestionStreamId = selectedQuestionArchiveEntry?.streamId ?? currentStream?.id ?? null;
  const selectedQuestionStreamTitle = selectedQuestionArchiveEntry?.streamTitle ?? currentStream?.title ?? null;
  const selectedQuestion = useMemo(
    () =>
      !selectedQuestionId
        ? null
        : (currentStream?.questions.find((q) => q.id === selectedQuestionId) ??
          questionArchive.find((q) => q.id === selectedQuestionId) ??
          null),
    [currentStream?.questions, questionArchive, selectedQuestionId],
  );
  const embedQuestionText = embedQuestionId
    ? (archivedQuestions.find((q) => q.id === embedQuestionId)?.text ??
       currentStream?.questions.find((q) => q.id === embedQuestionId)?.text ?? null)
    : null;

  // Timer remaining
  const timerRemaining = (() => {
    if (!deskActiveQuestion?.openedAt || !deskActiveQuestion?.timerSeconds || clockNow === null) return null;
    const expiresAt = new Date(deskActiveQuestion.openedAt).getTime() + deskActiveQuestion.timerSeconds * 1000;
    return Math.max(0, Math.ceil((expiresAt - clockNow) / 1000));
  })();

  /* ── Actions ── */
  async function runAction(url: string) {
    setError("");
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) { setError("Impossibile completare l'azione."); return; }
    await refreshOverview();
  }

  async function extendTimer(seconds: number) {
    if (!deskActiveQuestion) return;
    await fetch(`/api/admin/questions/${deskActiveQuestion.id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds }),
    });
    // Optimistically update the active question's timer display
    setActiveQuestion((prev) => prev ? { ...prev, timerSeconds: (prev.timerSeconds ?? 0) + seconds } : prev);
  }

  async function handleCreateLiveQuestion() {
    setError("");
    if (!questionDraft.text.trim()) { setError("Scrivi il testo della domanda."); return; }
    const res = await fetch("/api/admin/questions/live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: questionDraft.text,
        inputType: questionDraft.inputType,
        audienceType: questionDraft.audienceType,
        timerSeconds: questionDraft.timerSeconds,
        options: questionDraft.options.split("\n").map((s) => s.trim()).filter(Boolean),
        settings:
          questionDraft.inputType === "SCALE"
            ? { min: questionDraft.settings.min, max: questionDraft.settings.max, step: questionDraft.settings.step }
            : questionDraft.inputType === "WORD_COUNT"
              ? { maxWords: questionDraft.settings.maxWords }
              : undefined,
      }),
    });
    if (!res.ok) { setError("Impossibile inviare la domanda."); return; }
    setQuestionDraft((d) => ({ ...d, text: "", options: "" }));
    await refreshOverview();
  }

  async function handleEndLive() {
    if (!liveStream) return;
    if (!window.confirm(`Terminare la live "${liveStream.title}"?`)) return;
    if (!window.confirm("Conferma finale: vuoi davvero interrompere la live?")) return;
    await runAction(`/api/admin/streams/${liveStream.streamId}/end`);
  }

  async function updateEmbed(payload: unknown) {
    const res = await fetch("/api/admin/embed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) setError("Impossibile aggiornare l'embed.");
  }

  async function sendToEmbed() {
    if (!selectedQuestion) return;
    await updateEmbed({
      kind: "question",
      questionId: selectedQuestion.id,
      selectedAnswerIds: ["OPEN", "WORD_COUNT"].includes(selectedResults?.type ?? "") ? embedSelectionIds : undefined,
      featuredAnswerId: selectedResults?.type === "OPEN" ? featuredEmbedAnswerId : null,
    });
    setEmbedQuestionId(selectedQuestion.id);
  }

  async function clearEmbed() {
    await updateEmbed({ kind: "none" });
    setEmbedQuestionId(null);
  }

  const dashboardBackgroundStyle = liveStream
    ? {
        backgroundImage:
          "linear-gradient(to bottom, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.10) 18%, rgba(239, 68, 68, 0.00) 42%)",
        backgroundRepeat: "no-repeat",
      }
    : scheduledStream
      ? {
          backgroundImage:
            "linear-gradient(to bottom, rgba(245, 158, 11, 0.20) 0%, rgba(245, 158, 11, 0.09) 18%, rgba(245, 158, 11, 0.00) 42%)",
          backgroundRepeat: "no-repeat",
        }
      : undefined;

  /* ─── Render ─────────────────────────────────────────────────── */
  return (
    <div
      className="-mx-6 -mt-6 space-y-5 px-6 pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8"
      style={dashboardBackgroundStyle}
    >
      <div className="relative z-10 space-y-5">
      {/* ── Page header ── */}
      <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>

      {/* ── Error alert ── */}
      {error ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2.5 text-sm text-destructive-foreground">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
          <button type="button" onClick={() => setError("")} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── Command strip ── */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <div className="min-w-0 flex-1">
          {streamDisplayTitle ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                {liveStream ? "In onda" : scheduledStream ? "Prossima" : "Ultima"}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{streamDisplayTitle}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Nessuna stream configurata</p>
          )}
        </div>
        <LivePill status={streamStatus.status} startedAt={liveStream?.liveStartedAt} />
        <div className="flex shrink-0 items-center gap-2">
          {streamEditorId ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/streams/${streamEditorId}`}>Modifica</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/admin/streams/new">Nuova live</Link>
            </Button>
          )}
          {!liveStream && streamEditorId ? (
            <form action={`/api/admin/streams/${streamEditorId}/live`} method="post">
              <Button type="submit" size="sm">Vai live</Button>
            </form>
          ) : null}
          {liveStream ? (
            <Button variant="destructive" size="sm" onClick={handleEndLive}>
              <Square className="h-3.5 w-3.5" />
              Termina
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Main grid: Video | Question control ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Video preview */}
        <div className="aspect-video overflow-hidden rounded-xl border border-border bg-zinc-950">
          {streamPreviewUrl ? (
            <iframe src={streamPreviewUrl} className="h-full w-full" allow="fullscreen; autoplay" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-600">
              <MonitorPlay className="h-8 w-8" />
              <p className="text-sm">Nessun embed configurato</p>
            </div>
          )}
        </div>

        {/* ── Question control panel ── */}
        <div className="flex flex-col gap-3">

          {/* Active question */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-muted" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">In onda</p>
              </div>
              {deskActiveQuestion ? <Badge variant="live">Live</Badge> : null}
            </div>

            {deskActiveQuestion ? (
              <>
                <p className="mb-1 text-sm font-semibold text-foreground leading-snug">{deskActiveQuestion.text}</p>
                <p className="mb-3 text-xs text-muted">
                  {formatQuestionMeta(deskActiveQuestion.inputType, deskActiveQuestion.audienceType)}
                </p>

                {/* Timer */}
                {timerRemaining !== null && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums ${
                      timerRemaining > 30 ? "bg-success-subtle text-success-foreground"
                      : timerRemaining > 10 ? "bg-warning-subtle text-warning-foreground"
                      : "bg-destructive-subtle text-destructive-foreground"
                    }`}>
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimerRemaining(timerRemaining)}
                    </div>
                    <button
                      type="button"
                      onClick={() => extendTimer(30)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      +30s
                    </button>
                    <button
                      type="button"
                      onClick={() => extendTimer(60)}
                      className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      +60s
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setSelectedQuestionId(deskActiveQuestion.id)}>
                    Risposte
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => runAction(`/api/admin/questions/${deskActiveQuestion.id}/close`)}>
                    Chiudi
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">
                {activeQuestion && clockNow !== null && isQuestionExpiredAt(activeQuestion, clockNow)
                  ? "Timer scaduto."
                  : "Nessuna domanda in onda."}
              </p>
            )}
          </div>

          {/* Next question */}
          {nextQuestion ? (
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted">
                Prossima{scheduledQuestions.length > 1 ? ` (+${scheduledQuestions.length - 1} in coda)` : ""}
              </p>
              <p className="mb-1 text-sm font-medium text-foreground leading-snug">{nextQuestion.text}</p>
              <p className="mb-3 text-xs text-muted">{formatQuestionMeta(nextQuestion.inputType, nextQuestion.audienceType)}</p>
              <Button size="sm" onClick={() => runAction(`/api/admin/questions/${nextQuestion.id}/live`)}>
                <Play className="h-3.5 w-3.5" />
                Manda live
              </Button>
            </div>
          ) : null}

          {/* Quick-send form */}
          <div className="flex-1 rounded-xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Al volo</p>
              {!liveStream ? <Badge variant="secondary">Richiede live</Badge> : null}
            </div>
            <div className="space-y-2">
              {/* Text input with icon */}
              <div className="relative">
                <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={questionDraft.text}
                  onChange={(e) => setQuestionDraft((d) => ({ ...d, text: e.target.value }))}
                  placeholder="Testo domanda..."
                  disabled={!liveStream}
                  className="pl-8"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {/* Type with icon */}
                <div className="relative">
                  <List className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Select
                    value={questionDraft.inputType}
                    onChange={(e) => setQuestionDraft((d) => ({ ...d, inputType: e.target.value }))}
                    disabled={!liveStream}
                    className="pl-8"
                  >
                    <option value="OPEN">Aperta</option>
                    <option value="WORD_COUNT">Word cloud</option>
                    <option value="SCALE">Scala</option>
                    <option value="SINGLE_CHOICE">Singola</option>
                    <option value="MULTIPLE_CHOICE">Multipla</option>
                  </Select>
                </div>
                {/* Audience with icon */}
                <div className="relative">
                  <Users className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Select
                    value={questionDraft.audienceType}
                    onChange={(e) => setQuestionDraft((d) => ({ ...d, audienceType: e.target.value }))}
                    disabled={!liveStream}
                    className="pl-8"
                  >
                    <option value="CLASS">Classe</option>
                    <option value="INDIVIDUAL">Individuale</option>
                  </Select>
                </div>
              </div>

              {questionDraft.inputType === "SCALE" && (
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" value={questionDraft.settings.min} onChange={(e) => setQuestionDraft((d) => ({ ...d, settings: { ...d.settings, min: +e.target.value } }))} placeholder="Min" disabled={!liveStream} />
                  <Input type="number" value={questionDraft.settings.max} onChange={(e) => setQuestionDraft((d) => ({ ...d, settings: { ...d.settings, max: +e.target.value } }))} placeholder="Max" disabled={!liveStream} />
                  <Input type="number" value={questionDraft.settings.step} onChange={(e) => setQuestionDraft((d) => ({ ...d, settings: { ...d.settings, step: +e.target.value } }))} placeholder="Step" disabled={!liveStream} />
                </div>
              )}
              {questionDraft.inputType === "WORD_COUNT" && (
                <Input type="number" value={questionDraft.settings.maxWords} onChange={(e) => setQuestionDraft((d) => ({ ...d, settings: { ...d.settings, maxWords: +e.target.value } }))} placeholder="Parole max" disabled={!liveStream} />
              )}
              {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionDraft.inputType) && (
                <Textarea value={questionDraft.options} onChange={(e) => setQuestionDraft((d) => ({ ...d, options: e.target.value }))} placeholder="Una opzione per riga" rows={3} disabled={!liveStream} />
              )}

              <div className="flex items-center gap-2">
                {/* Timer with icon */}
                <div className="relative w-20 shrink-0">
                  <Clock className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    type="number"
                    value={questionDraft.timerSeconds}
                    onChange={(e) => setQuestionDraft((d) => ({ ...d, timerSeconds: +e.target.value }))}
                    disabled={!liveStream}
                    className="pl-7"
                    title="Timer in secondi"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateLiveQuestion}
                  disabled={!liveStream || isPending || !questionDraft.text.trim()}
                  title="Invia live"
                  className="flex h-9 flex-1 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-all hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-40"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Question archive + results ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {/* Collapsible header */}
        <button
          type="button"
          onClick={() => setArchiveOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-border px-4 py-3 transition-colors hover:bg-surface-raised"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Archivio domande</h2>
            <span className="text-xs text-muted">({archivedQuestions.length})</span>
          </div>
          {archiveOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </button>

        {archiveOpen && (
          <>
            {/* ── Embed status strip ── */}
            <div className="flex items-center gap-3 border-b border-border bg-surface-raised px-4 py-2">
              <MonitorPlay className="h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0 flex-1">
                {embedQuestionText ? (
                  <p className="truncate text-xs text-foreground">
                    <span className="text-muted">Embed attivo: </span>{embedQuestionText}
                  </p>
                ) : (
                  <p className="text-xs text-muted">Embed vuoto</p>
                )}
              </div>
              <button
                type="button"
                onClick={clearEmbed}
                title="Svuota embed"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-destructive-subtle hover:text-destructive-foreground"
              >
                <MonitorX className="h-3.5 w-3.5" />
              </button>
            </div>

            <div
              ref={archiveSplitRef}
              className="grid divide-y divide-border md:divide-y-0"
              style={{ gridTemplateColumns: `minmax(240px, ${archiveSidebarWidth}px) 8px minmax(0, 1fr)` }}
            >
              {/* Question list */}
              <div className="max-h-[360px] overflow-y-auto">
                {archivedQuestions.length ? (
                  <>
                    {currentArchiveQuestions.length > 0 && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setCurrentSectionOpen((value) => !value)}
                          className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-surface px-4 py-2 text-left transition-colors hover:bg-surface-raised"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                            Live attuale
                          </p>
                          {currentSectionOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                        </button>
                        {currentSectionOpen && currentArchiveQuestions.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => startTransition(() => setSelectedQuestionId(q.id))}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised ${
                              selectedQuestionId === q.id ? "bg-accent-subtle" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`line-clamp-2 text-sm ${selectedQuestionId === q.id ? "font-medium text-accent" : "text-foreground"}`}>
                                {q.text}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted">
                                {formatQuestionMeta(q.inputType, q.audienceType)}
                                {embedQuestionId === q.id && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-accent">
                                    <MonitorPlay className="h-2.5 w-2.5" /> embed
                                  </span>
                                )}
                              </p>
                            </div>
                            {q.status === "LIVE" && (
                              <Badge variant="live" className="mt-0.5 shrink-0">
                                Live
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {pastArchiveQuestions.length > 0 && (
                      <div className="border-t border-border">
                        <button
                          type="button"
                          onClick={() => setPastSectionOpen((value) => !value)}
                          className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-surface px-4 py-2 text-left transition-colors hover:bg-surface-raised"
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                            Live passate
                          </p>
                          {pastSectionOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted" /> : <ChevronDown className="h-3.5 w-3.5 text-muted" />}
                        </button>
                        {pastSectionOpen && pastArchiveQuestions.map((q) => (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => startTransition(() => setSelectedQuestionId(q.id))}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised ${
                              selectedQuestionId === q.id ? "bg-accent-subtle" : ""
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`line-clamp-2 text-sm ${selectedQuestionId === q.id ? "font-medium text-accent" : "text-foreground"}`}>
                                {q.text}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted">
                                {formatQuestionMeta(q.inputType, q.audienceType)}
                                {q.streamTitle ? ` · ${q.streamTitle}` : ""}
                                {embedQuestionId === q.id && (
                                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-accent">
                                    <MonitorPlay className="h-2.5 w-2.5" /> embed
                                  </span>
                                )}
                              </p>
                            </div>
                            {q.status === "LIVE" && (
                              <Badge variant="live" className="mt-0.5 shrink-0">
                                Live
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="p-4 text-sm text-muted">Nessuna domanda archiviata.</p>
                )}
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={() => setIsResizingArchive(true)}
                className="group hidden cursor-col-resize items-stretch justify-center bg-transparent md:flex"
              >
                <div
                  className={cn(
                    "w-px rounded-full bg-border transition-colors",
                    isResizingArchive ? "bg-accent/45" : "group-hover:bg-accent/25",
                  )}
                />
              </div>

              {/* Results panel */}
              <div className="min-w-0 p-4">
                {selectedQuestion && (
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{selectedQuestion.text}</p>
                      <p className="mt-1 text-xs font-medium text-muted">
                        {formatQuestionMeta(selectedQuestion.inputType, selectedQuestion.audienceType)}
                        {" · "}{selectedResults?.totalAnswers ?? 0} risposte
                      </p>
                      {(selectedQuestionStreamId && selectedQuestionStreamTitle) && (
                        <Link
                          href={`/admin/streams/${selectedQuestionStreamId}`}
                          className="mt-1 inline-flex text-xs font-medium text-accent transition-colors hover:text-accent-hover"
                        >
                          {selectedQuestionStreamTitle}
                        </Link>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {embedQuestionId === selectedQuestion.id && (
                        <MonitorPlay className="h-3.5 w-3.5 text-accent" />
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={sendToEmbed}
                      >
                        <MonitorPlay className="h-3.5 w-3.5" />
                        Manda a embed
                      </Button>
                    </div>
                  </div>
                )}

                {selectedResultsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-raised" />
                    ))}
                  </div>
                ) : !selectedQuestion ? (
                  <p className="text-sm text-muted">Seleziona una domanda dall&apos;archivio.</p>
                ) : !selectedResults ? (
                  <p className="text-sm text-muted">Nessun risultato da mostrare.</p>
                ) : (
                  <div className={selectedResults.type === "SCALE" ? "h-[280px] overflow-hidden" : "max-h-[320px] overflow-y-auto"}>
                    <ResultsBody
                      results={selectedResults}
                      embedSelectionIds={embedSelectionIds}
                      featuredEmbedAnswerId={featuredEmbedAnswerId}
                      onEmbedSelectionChange={setEmbedSelectionIds}
                      onFeaturedChange={setFeaturedEmbedAnswerId}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Recent streams ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface p-0">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Stream recenti</h2>
              <p className="mt-0.5 text-xs text-muted">Programmate e concluse, con accesso rapido all&apos;editor.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" asChild><Link href="/admin/streams">Vedi tutte</Link></Button>
              <Button size="sm" asChild><Link href="/admin/streams/new">Nuova</Link></Button>
            </div>
          </div>
        </div>
        {recentStreams.length ? (
          <div className="divide-y divide-border">
            {recentStreams.map((stream) => (
              <Link
                key={stream.id}
                href={`/admin/streams/${stream.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-raised"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{stream.title}</p>
                    <Badge
                      variant={stream.status === "LIVE" ? "live" : stream.status === "SCHEDULED" ? "warning" : "secondary"}
                      className="shrink-0"
                    >
                      {stream.status === "LIVE" ? "Live" : stream.status === "SCHEDULED" ? "Programmata" : "Conclusa"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Non programmata"} · {stream.questionsCount} domande
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-muted">Apri</span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted">Nessuna stream recente.</p>
        )}
      </div>
      </div>

      {/* ── Notifications ── */}
      <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg animate-slide-up">
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
              n.tone === "success" ? "bg-success-subtle text-success-foreground"
              : n.tone === "warning" ? "bg-warning-subtle text-warning-foreground"
              : "bg-accent-subtle text-accent"
            }`}>
              <Bell className="h-2.5 w-2.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{n.title}</p>
              {n.description ? <p className="mt-0.5 truncate text-xs text-muted">{n.description}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
