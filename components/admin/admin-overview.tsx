"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  List,
  MonitorPlay,
  MonitorX,
  Play,
  Radio,
  SendHorizontal,
  Square,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  formatQuestionMeta,
  formatViewerQuestionClassLabel,
} from "@/components/admin/overview/format";
import { LivePill } from "@/components/admin/overview/live-pill";
import { NotificationStack } from "@/components/admin/overview/notification-stack";
import { ResultsBody } from "@/components/admin/overview/results-body";
import { useNotifications } from "@/components/admin/overview/use-notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTimerRemaining, getQuestionTimerState, isQuestionExpiredAt } from "@/lib/question-timer";
import { getSocket } from "@/lib/socket-client";
import { useClock } from "@/lib/use-clock";
import type { CurrentStreamSummary, QuestionArchiveEntry, StreamSummary } from "@/lib/admin-data";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse, ViewerQuestionPayload } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

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
  const [selectedResultsLoading, setSelectedResultsLoading] = useState(false);
  const [embedSelectionIds, setEmbedSelectionIds] = useState<string[]>([]);
  const [featuredEmbedAnswerId, setFeaturedEmbedAnswerId] = useState<string | null>(null);
  const clockNow = useClock();
  const [archiveOpen, setArchiveOpen] = useState(true);
  const [archiveSidebarWidth, setArchiveSidebarWidth] = useState(320);
  const [isResizingArchive, setIsResizingArchive] = useState(false);
  const [currentSectionOpen, setCurrentSectionOpen] = useState(true);
  const [pastSectionOpen, setPastSectionOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const { notifications, pushNotification } = useNotifications();

  // Embed state tracking
  const [embedQuestionId, setEmbedQuestionId] = useState<string | null>(null);
  const [embedSending, setEmbedSending] = useState(false);

  const selectedQuestionRef = useRef(selectedQuestionId);
  const embedQuestionIdRef = useRef(embedQuestionId);
  const embedSelectionIdsRef = useRef(embedSelectionIds);
  const featuredEmbedAnswerIdRef = useRef(featuredEmbedAnswerId);
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

    // Every listener is removed by reference below: the socket is a shared
    // singleton, so off() without the handler would also drop the listeners
    // registered by DashboardClassesSidebar and by the OBS overlay.
    const onViewerQuestion = (p: ViewerQuestionPayload) =>
      pushNotification("Domanda dal pubblico", `${formatViewerQuestionClassLabel(p)} · ${p.text}`, "info");
    const onResultsUpdate = (p: ResultsPayload) => {
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
    };
    const onQuestionPush = (p: QuestionPayload) => {
      setActiveQuestion(p);
      if (!selectedQuestionRef.current) setSelectedQuestionId(p.id);
      pushNotification("Domanda live", p.text, "success");
      void refreshOverview();
    };
    const onQuestionUpdate = (p: QuestionPayload) => {
      setActiveQuestion((current) => (current?.id === p.id ? p : current));
    };
    const onQuestionClose = () => {
      setActiveQuestion(null);
      pushNotification("Domanda chiusa", undefined, "warning");
      void refreshOverview();
    };
    const onStreamStatus = (p: StreamStatusResponse) => {
      setStreamStatus(p);
      if (p.status === "live") pushNotification("Live in onda", (p as { title?: string }).title, "success");
      else if (p.status === "scheduled") pushNotification("Live programmata", undefined, "info");
      else pushNotification("Live terminata", undefined, "warning");
      void refreshOverview();
    };

    socket.on("viewer-question:new", onViewerQuestion);
    socket.on("results:update", onResultsUpdate);
    socket.on("question:push", onQuestionPush);
    socket.on("question:update", onQuestionUpdate);
    socket.on("question:close", onQuestionClose);
    socket.on("stream:status", onStreamStatus);

    return () => {
      socket.off("viewer-question:new", onViewerQuestion);
      socket.off("results:update", onResultsUpdate);
      socket.off("question:push", onQuestionPush);
      socket.off("question:update", onQuestionUpdate);
      socket.off("question:close", onQuestionClose);
      socket.off("stream:status", onStreamStatus);
    };
  }, [pushNotification]); // socket setup only on mount; pushNotification is stable

  // Notification timers are cleaned up by useNotifications().

  useEffect(() => {
    const iv = setInterval(refreshOverview, 12000);
    return () => clearInterval(iv);
  }, []); // intentional: polling setup only on mount

  // The synchronous branches below settle the panel from state already in hand
  // (the live results, or the cache) so no request is made and no spinner is
  // shown; only the cache miss actually fetches. Writing that synchronously is
  // the point, hence the rule is off for this effect.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  /* eslint-enable react-hooks/set-state-in-effect */

  // Reset selections only when the selected question changes, NOT on every
  // result update. Adjusted during render (React's documented pattern for
  // resetting state on a change) rather than in an effect, so the stale
  // selection is never rendered for a frame against the new question.
  const [selectionOwnerId, setSelectionOwnerId] = useState(selectedQuestionId);
  if (selectionOwnerId !== selectedQuestionId) {
    setSelectionOwnerId(selectedQuestionId);
    setEmbedSelectionIds([]);
    setFeaturedEmbedAnswerId(null);
  }

  /* ── Derived state ── */
  const liveStream = streamStatus.status === "live" ? streamStatus : null;
  const scheduledStream = streamStatus.status === "scheduled" ? streamStatus : null;
  const streamPreviewUrl = liveStream?.embedUrl ?? scheduledStream?.embedUrl ?? currentStream?.embedUrl ?? null;
  const streamEditorId = liveStream?.streamId ?? scheduledStream?.streamId ?? currentStream?.id ?? streams.drafts[0]?.id ?? null;
  const streamDisplayTitle = liveStream?.title ?? scheduledStream?.title ?? currentStream?.title ?? null;
  const deskActiveQuestion = activeQuestion && (clockNow === null || !isQuestionExpiredAt(activeQuestion, clockNow))
    ? activeQuestion
    : null;
  const activeQuestionTimer = getQuestionTimerState(deskActiveQuestion, clockNow);
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

  /* ── Actions ── */
  async function runAction(url: string) {
    setError("");
    const res = await fetch(url, { method: "POST" });
    if (!res.ok) { setError("Impossibile completare l'azione."); return; }
    await refreshOverview();
  }

  async function extendTimer(seconds: number) {
    if (!deskActiveQuestion) return;
    const res = await fetch(`/api/admin/questions/${deskActiveQuestion.id}/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds }),
    });
    if (!res.ok) {
      setError("Impossibile aggiornare il timer.");
      return;
    }

    const payload = (await res.json().catch(() => null)) as { question?: QuestionPayload } | null;
    if (payload?.question) {
      const question = payload.question;
      setActiveQuestion((current) => (current?.id === question.id ? question : current));
    }
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
    if (!selectedQuestion || embedSending) return;
    setEmbedSending(true);
    try {
      await updateEmbed({
        kind: "question",
        questionId: selectedQuestion.id,
        selectedAnswerIds: ["OPEN", "WORD_COUNT"].includes(selectedResults?.type ?? "") ? embedSelectionIds : undefined,
        featuredAnswerId: selectedResults?.type === "OPEN" ? featuredEmbedAnswerId : null,
      });
      setEmbedQuestionId(selectedQuestion.id);
      pushNotification("Embed aggiornato", selectedQuestion.text, "success");
    } finally {
      setEmbedSending(false);
    }
  }

  async function clearEmbed() {
    await updateEmbed({ kind: "none" });
    setEmbedQuestionId(null);
    pushNotification("Embed svuotato", undefined, "warning");
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
                {activeQuestionTimer.kind !== "expired" && (
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums ${
                      activeQuestionTimer.kind === "active"
                        ? activeQuestionTimer.remainingSeconds > 30
                          ? "bg-success-subtle text-success-foreground"
                          : activeQuestionTimer.remainingSeconds > 10
                            ? "bg-warning-subtle text-warning-foreground"
                            : "bg-destructive-subtle text-destructive-foreground"
                        : activeQuestionTimer.kind === "pending"
                          ? "bg-warning-subtle text-warning-foreground"
                          : "bg-surface-raised text-muted"
                    }`}>
                      <Clock className="h-3.5 w-3.5" />
                      {activeQuestionTimer.kind === "active"
                        ? formatTimerRemaining(activeQuestionTimer.remainingSeconds)
                        : activeQuestionTimer.kind === "pending"
                          ? "Timer in avvio"
                          : "Senza timer"}
                    </div>
                    {activeQuestionTimer.kind !== "none" && (
                      <>
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
                      </>
                    )}
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
                      <Button
                        size="sm"
                        variant={embedQuestionId === selectedQuestion.id ? "secondary" : "default"}
                        onClick={sendToEmbed}
                        disabled={embedSending}
                      >
                        <MonitorPlay className="h-3.5 w-3.5" />
                        {embedSending
                          ? "Invio…"
                          : embedQuestionId === selectedQuestion.id
                            ? "Aggiorna embed"
                            : "Manda a embed"}
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

      <NotificationStack notifications={notifications} />
    </div>
  );
}
