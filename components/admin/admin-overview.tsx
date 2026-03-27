"use client";

import Link from "next/link";
import { Bell, Clock3, MonitorPlay, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { CurrentStreamSummary, QuestionArchiveEntry, StreamSummary } from "@/lib/admin-data";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse, ViewerQuestionPayload } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type OverviewPayload = {
  streamStatus: StreamStatusResponse;
  activeQuestion: QuestionPayload | null;
  results: ResultsPayload | null;
  currentStream: CurrentStreamSummary | null;
  streams: {
    upcoming: StreamSummary[];
    past: StreamSummary[];
    drafts: StreamSummary[];
  };
  questionArchive: QuestionArchiveEntry[];
  viewerQuestions: ViewerQuestionPayload[];
};

type QuestionDraft = {
  text: string;
  inputType: string;
  audienceType: string;
  timerSeconds: number;
  options: string;
};

type DashboardNotification = {
  id: number;
  title: string;
  description?: string;
  tone: "info" | "success" | "warning";
};

function formatViewerQuestionClassLabel(entry: ViewerQuestionPayload) {
  if (entry.classYear === null || !entry.classSection) {
    return "Pubblico";
  }

  return `${getYearLabel(entry.classYear)}${entry.classSection}`;
}

function formatLiveElapsed(startedAt: string | null | undefined, now: number) {
  if (!startedAt) {
    return "00:00";
  }

  const elapsedMs = Math.max(0, now - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStreamStatusBadge(status: StreamStatusResponse["status"]) {
  if (status === "live") {
    return "bg-terracotta/15 text-terracotta";
  }

  if (status === "scheduled") {
    return "bg-gold/20 text-ocean";
  }

  return "bg-slate-200 text-slate-700";
}

function getNotificationToneClasses(tone: DashboardNotification["tone"]) {
  if (tone === "success") {
    return "border-sage/25 bg-white text-ink";
  }

  if (tone === "warning") {
    return "border-terracotta/25 bg-white text-ink";
  }

  return "border-ocean/15 bg-white text-ink";
}

function LiveStatusPill({
  status,
  startedAt,
}: {
  status: StreamStatusResponse["status"];
  startedAt?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || status !== "live" || !startedAt) {
      setNow(null);
      return;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [mounted, startedAt, status]);

  const label = status === "live" ? "In onda" : status === "scheduled" ? "Programmata" : "Offline";
  const elapsed = mounted && now !== null && status === "live" && startedAt ? formatLiveElapsed(startedAt, now) : null;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${getStreamStatusBadge(status)}`}>
      {status === "live" ? <Clock3 className="h-4 w-4" /> : null}
      <span>{label}</span>
      {elapsed ? <span className="text-[11px] tracking-[0.14em]">{elapsed}</span> : null}
    </span>
  );
}

export function AdminOverview({
  initialOverview,
  focusSection,
}: {
  initialOverview: OverviewPayload;
  focusSection?: string;
}) {
  const [streamStatus, setStreamStatus] = useState(initialOverview.streamStatus);
  const [currentStream, setCurrentStream] = useState<CurrentStreamSummary | null>(initialOverview.currentStream);
  const [streams, setStreams] = useState(initialOverview.streams);
  const [questionArchive, setQuestionArchive] = useState(initialOverview.questionArchive);
  const [activeQuestion, setActiveQuestion] = useState(initialOverview.activeQuestion);
  const [results, setResults] = useState(initialOverview.results);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialOverview.activeQuestion?.id ?? initialOverview.currentStream?.questions?.[0]?.id ?? null,
  );
  const [selectedResults, setSelectedResults] = useState<ResultsPayload | null>(initialOverview.results);
  const [error, setError] = useState("");
  const [questionDraft, setQuestionDraft] = useState<QuestionDraft>({
    text: "",
    inputType: "OPEN",
    audienceType: "CLASS",
    timerSeconds: 60,
    options: "",
  });
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [selectedResultsLoading, setSelectedResultsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedQuestionRef = useRef(selectedQuestionId);
  const notificationIdRef = useRef(0);
  const notificationTimeoutsRef = useRef<number[]>([]);
  const resultsCacheRef = useRef(
    new Map<string, ResultsPayload>(initialOverview.results ? [[initialOverview.results.questionId, initialOverview.results]] : []),
  );

  useEffect(() => {
    selectedQuestionRef.current = selectedQuestionId;
  }, [selectedQuestionId]);

  function pushNotification(title: string, description: string | undefined, tone: DashboardNotification["tone"]) {
    const id = notificationIdRef.current + 1;
    notificationIdRef.current = id;

    setNotifications((current) => [...current, { id, title, description, tone }].slice(-4));

    const timeout = window.setTimeout(() => {
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      notificationTimeoutsRef.current = notificationTimeoutsRef.current.filter((entry) => entry !== timeout);
    }, 4200);

    notificationTimeoutsRef.current.push(timeout);
  }

  async function refreshOverview() {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as OverviewPayload;
    startTransition(() => {
      setStreamStatus(payload.streamStatus);
      setCurrentStream(payload.currentStream);
      setStreams(payload.streams);
      setQuestionArchive(payload.questionArchive);
      setActiveQuestion(payload.activeQuestion);
      setResults(payload.results);
      if (payload.results) {
        resultsCacheRef.current.set(payload.results.questionId, payload.results);
      }
    });
  }

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join");
    socket.on("viewer-question:new", (payload: ViewerQuestionPayload) => {
      pushNotification("Nuova domanda dal pubblico", `${formatViewerQuestionClassLabel(payload)} • ${payload.text}`, "info");
    });
    socket.on("results:update", (payload: ResultsPayload) => {
      resultsCacheRef.current.set(payload.questionId, payload);
      setResults(payload);
      if (selectedQuestionRef.current === payload.questionId) {
        setSelectedResults(payload);
      }
      pushNotification("Risultati aggiornati", "Le risposte della domanda selezionata sono state aggiornate.", "success");
    });
    socket.on("question:push", (payload: QuestionPayload) => {
      setActiveQuestion(payload);
      if (!selectedQuestionRef.current) {
        setSelectedQuestionId(payload.id);
      }
      pushNotification("Domanda aggiornata", payload.text, "success");
      void refreshOverview();
    });
    socket.on("question:close", () => {
      setActiveQuestion(null);
      setResults(null);
      if (selectedQuestionRef.current === activeQuestion?.id) {
        setSelectedResults(null);
      }
      pushNotification("Domanda chiusa", "La domanda live non è più visibile alle classi.", "warning");
      void refreshOverview();
    });
    socket.on("stream:status", (payload: StreamStatusResponse) => {
      setStreamStatus(payload);
      if (payload.status === "live") {
        pushNotification("Live in onda", payload.title, "success");
      } else if (payload.status === "scheduled") {
        pushNotification("Live programmata", payload.title, "info");
      } else {
        pushNotification("Live terminata", "Non ci sono stream attive in questo momento.", "warning");
      }
      void refreshOverview();
    });

    return () => {
      socket.off("viewer-question:new");
      socket.off("results:update");
      socket.off("question:push");
      socket.off("question:close");
      socket.off("stream:status");
    };
  }, [activeQuestion?.id]);

  useEffect(() => {
    return () => {
      notificationTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    if (selectedQuestionId && results?.questionId === selectedQuestionId) {
      resultsCacheRef.current.set(results.questionId, results);
      setSelectedResults(results);
      setSelectedResultsLoading(false);
    }
  }, [results, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestionId) {
      setSelectedResults(null);
      setSelectedResultsLoading(false);
      return;
    }
    if (results?.questionId === selectedQuestionId) {
      resultsCacheRef.current.set(results.questionId, results);
      setSelectedResults(results);
      setSelectedResultsLoading(false);
      return;
    }

    const cached = resultsCacheRef.current.get(selectedQuestionId);
    if (cached) {
      setSelectedResults(cached);
      setSelectedResultsLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestedId = selectedQuestionId;
    setSelectedResultsLoading(true);
    void fetch(`/api/admin/questions/${selectedQuestionId}/summary`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.results) {
          const nextResults = payload.results as ResultsPayload;
          resultsCacheRef.current.set(nextResults.questionId, nextResults);
          if (selectedQuestionRef.current === requestedId) {
            setSelectedResults(nextResults);
          }
        }
      })
      .finally(() => {
        if (selectedQuestionRef.current === requestedId) {
          setSelectedResultsLoading(false);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [selectedQuestionId, results, results?.questionId]);

  useEffect(() => {
    const interval = setInterval(refreshOverview, 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!focusSection) {
      return;
    }
    const target = document.getElementById(focusSection);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusSection]);

  const activeQuestions = currentStream?.questions.filter((question) => ["LIVE", "RESULTS"].includes(question.status)) ?? [];
  const scheduledQuestions = currentStream?.questions.filter((question) => question.status === "DRAFT") ?? [];

  const selectedQuestion = useMemo(() => {
    if (!selectedQuestionId) {
      return null;
    }
    return (
      currentStream?.questions.find((question) => question.id === selectedQuestionId) ??
      questionArchive.find((question) => question.id === selectedQuestionId) ??
      null
    );
  }, [currentStream?.questions, questionArchive, selectedQuestionId]);

  async function runAction(url: string) {
    setError("");
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      setError("Impossibile completare l'azione richiesta.");
      return;
    }
    await refreshOverview();
  }

  async function handleCreateLiveQuestion() {
    setError("");
    if (!questionDraft.text.trim()) {
      setError("Scrivi il testo della domanda.");
      return;
    }

    const response = await fetch("/api/admin/questions/live", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: questionDraft.text,
        inputType: questionDraft.inputType,
        audienceType: questionDraft.audienceType,
        timerSeconds: questionDraft.timerSeconds,
        options: questionDraft.options
          .split("\n")
          .map((entry) => entry.trim())
          .filter(Boolean),
      }),
    });

    if (!response.ok) {
      setError("Non è stato possibile inviare la domanda.");
      return;
    }

    setQuestionDraft((current) => ({ ...current, text: "", options: "" }));
    await refreshOverview();
  }

  async function handleEndLive() {
    if (!liveStream) {
      return;
    }

    const firstConfirmation = window.confirm(`Terminare la live "${liveStream.title}"?`);
    if (!firstConfirmation) {
      return;
    }

    const secondConfirmation = window.confirm("Conferma finale: vuoi davvero interrompere la live adesso?");
    if (!secondConfirmation) {
      return;
    }

    await runAction(`/api/admin/streams/${liveStream.streamId}/end`);
  }

  const liveStream = streamStatus.status === "live" ? streamStatus : null;
  const scheduledStream = streamStatus.status === "scheduled" ? streamStatus : null;
  const streamPreviewUrl = liveStream?.embedUrl ?? scheduledStream?.embedUrl ?? currentStream?.embedUrl ?? null;
  const streamEditorId = liveStream?.streamId ?? scheduledStream?.streamId ?? currentStream?.id ?? streams.drafts[0]?.id ?? null;
  const streamDisplayTitle = liveStream?.title ?? scheduledStream?.title ?? currentStream?.title ?? "Nessuna live in onda";
  const deskActiveQuestion = activeQuestions[0] ?? activeQuestion ?? null;
  const nextQuestion = scheduledQuestions[0] ?? null;
  const archivedQuestions = questionArchive.slice(0, 12);
  const recentPastStreams = streams.past.slice(0, 3);

  return (
    <div className="relative space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-ocean/70">Area amministrativa</p>
          <h1 className="text-4xl font-semibold text-ink">Dashboard live</h1>
        </div>
      </div>

      <div className="min-w-0 space-y-6">
        <section className="rounded-[34px] border border-ocean/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(240,247,255,0.9))] p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="mt-2 text-3xl font-semibold text-ink">Live</h2>
              <LiveStatusPill status={streamStatus.status} startedAt={liveStream?.liveStartedAt} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
              <div className="overflow-hidden rounded-[30px] border border-ocean/10 bg-ink shadow-soft">
                <div className="aspect-[16/9] w-full">
                  {streamPreviewUrl ? (
                    <iframe src={streamPreviewUrl} className="h-full w-full" allow="fullscreen; autoplay" />
                  ) : (
                    <div className="flex h-full flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,#10243a,#08121f)] p-8 text-white">
                      <div className="flex items-center gap-3 text-sm uppercase tracking-[0.18em] text-white/70">
                        <MonitorPlay className="h-4 w-4" />
                        Anteprima non disponibile
                      </div>
                      <div>
                        <p className="max-w-lg text-white/75">Apri o crea una stream nella sezione storica qui sotto per vedere l’anteprima.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-full flex-col justify-end gap-4 rounded-[30px] border border-ocean/10 bg-white/82 p-5 shadow-soft">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">
                    {liveStream ? "Live attiva" : scheduledStream ? "Stream pronta" : "Sala pronta"}
                  </p>
                  <h3 className="mt-2 text-3xl font-semibold text-ink">{streamDisplayTitle}</h3>
                </div>

                <div className="rounded-[24px] border border-ocean/10 bg-ocean/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ocean/65">Link embed</p>
                  {streamPreviewUrl ? (
                    <a
                      href={streamPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-sm font-medium text-ocean underline-offset-4 hover:underline"
                    >
                      {streamPreviewUrl}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm text-ink/55">Nessun link disponibile.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {streamEditorId ? (
                    <Button variant="secondary" asChild>
                      <Link href={`/admin/streams/${streamEditorId}`}>Modifica live</Link>
                    </Button>
                  ) : null}
                  {liveStream ? (
                    <Button variant="danger" onClick={handleEndLive}>
                      Termina live
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
        </section>

          <section className="rounded-[34px] border border-ocean/10 bg-white/82 p-6 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <h2 className="mt-2 text-3xl font-semibold text-ink">Regia domande</h2>
              {error ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-2 text-sm font-semibold text-terracotta">
                  <TriangleAlert className="h-4 w-4" />
                  {error}
                </div>
              ) : null}
            </div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_0.9fr_1.2fr]">
              <div className="rounded-[28px] border border-ocean/10 bg-white/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Domanda attiva</h3>
                  {deskActiveQuestion ? <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-ocean">Live</span> : null}
                </div>
                <p className="mt-4 text-lg font-semibold text-ink">{deskActiveQuestion?.text ?? "Nessuna domanda in onda."}</p>
                <p className="mt-2 text-sm text-ink/60">
                  {deskActiveQuestion
                    ? `${deskActiveQuestion.inputType} · ${deskActiveQuestion.audienceType}`
                    : "Quando mandi una domanda live la vedi qui."}
                </p>
                {deskActiveQuestion ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setSelectedQuestionId(deskActiveQuestion.id)}>
                      Apri risposte
                    </Button>
                    <Button variant="ghost" onClick={() => runAction(`/api/admin/questions/${deskActiveQuestion.id}/close`)}>
                      Chiudi
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-ocean/10 bg-white/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Prossima domanda</h3>
                  {scheduledQuestions.length ? (
                    <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold text-ocean">
                      {scheduledQuestions.length}
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-lg font-semibold text-ink">{nextQuestion?.text ?? "Nessuna domanda pronta."}</p>
                <p className="mt-2 text-sm text-ink/60">
                  {nextQuestion
                    ? `${nextQuestion.inputType} · ${nextQuestion.audienceType}`
                    : "Aggiungi o prepara una domanda nella live per vederla qui."}
                </p>
                {nextQuestion ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => runAction(`/api/admin/questions/${nextQuestion.id}/live`)}>Vai live</Button>
                    <Button variant="secondary" onClick={() => setSelectedQuestionId(nextQuestion.id)}>
                      Apri dettaglio
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-ocean/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(242,248,255,0.92))] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-ink">Aggiungi una domanda al momento</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/50">
                    {liveStream ? "Live disponibile" : "Solo con live attiva"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <input
                    value={questionDraft.text}
                    onChange={(event) => setQuestionDraft((current) => ({ ...current, text: event.target.value }))}
                    placeholder="Testo domanda"
                    className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                    disabled={!liveStream}
                  />
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px]">
                    <select
                      value={questionDraft.inputType}
                      onChange={(event) => setQuestionDraft((current) => ({ ...current, inputType: event.target.value }))}
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      disabled={!liveStream}
                    >
                      <option value="OPEN">Aperta</option>
                      <option value="WORD_COUNT">Word count</option>
                      <option value="SCALE">Scala</option>
                      <option value="SINGLE_CHOICE">Scelta singola</option>
                      <option value="MULTIPLE_CHOICE">Scelta multipla</option>
                    </select>
                    <select
                      value={questionDraft.audienceType}
                      onChange={(event) => setQuestionDraft((current) => ({ ...current, audienceType: event.target.value }))}
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      disabled={!liveStream}
                    >
                      <option value="CLASS">Classe</option>
                      <option value="INDIVIDUAL">Individuale</option>
                    </select>
                    <input
                      type="number"
                      value={questionDraft.timerSeconds}
                      onChange={(event) =>
                        setQuestionDraft((current) => ({ ...current, timerSeconds: Number(event.target.value) }))
                      }
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      placeholder="Timer"
                      disabled={!liveStream}
                    />
                  </div>
                  {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionDraft.inputType) ? (
                    <textarea
                      value={questionDraft.options}
                      onChange={(event) => setQuestionDraft((current) => ({ ...current, options: event.target.value }))}
                      className="min-h-24 w-full rounded-2xl border border-ocean/10 px-4 py-3"
                      placeholder="Una opzione per riga"
                      disabled={!liveStream}
                    />
                  ) : null}
                  <div className="flex justify-end">
                    <Button onClick={handleCreateLiveQuestion} disabled={!liveStream || isPending}>
                      Invia live
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-ocean/10 bg-white/75 p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
                <div className="min-h-0">
                  <h3 className="text-lg font-semibold text-ink">Ultime domande</h3>
                  <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto overscroll-contain pr-2 md:max-h-[420px]">
                    {archivedQuestions.length ? (
                      archivedQuestions.map((question) => (
                        <button
                          key={question.id}
                          type="button"
                          onClick={() =>
                            startTransition(() => {
                              setSelectedQuestionId(question.id);
                            })
                          }
                          className={`flex w-full flex-col rounded-2xl border px-4 py-3 text-left transition-colors ${
                            selectedQuestionId === question.id ? "border-ocean/30 bg-ocean/5" : "border-ocean/10 bg-white hover:border-ocean/20 hover:bg-ocean/5"
                          }`}
                        >
                          <span className="line-clamp-2 font-semibold text-ink">{question.text}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-ink/60">Nessuna domanda archiviata.</p>
                    )}
                  </div>
                </div>

                <div className="min-h-[220px]">
                  <h3 className="text-lg font-semibold text-ink">Risposte associate</h3>
                  {selectedQuestion ? <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink">{selectedQuestion.text}</p> : null}
                  <div className="mt-4 space-y-2">
                    {selectedResultsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="h-14 animate-pulse rounded-2xl border border-ocean/10 bg-ocean/5" />
                        ))}
                      </div>
                    ) : !selectedResults ? (
                      <p className="text-sm text-ink/60">Seleziona una domanda per vedere le risposte.</p>
                    ) : selectedResults.latestSubmissions?.length ? (
                      selectedResults.latestSubmissions.slice(0, 12).map((entry, index) => (
                        <div key={`${entry.value}-${index}`} className="rounded-2xl border border-ocean/10 bg-white px-3 py-2">
                          <p className="text-sm font-medium text-ink">{entry.value || "-"}</p>
                          <p className="text-xs text-ink/50">{entry.classLabel ?? "Classe non indicata"}</p>
                        </div>
                      ))
                    ) : (
                      selectedResults.entries.map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between rounded-2xl border border-ocean/10 bg-white px-3 py-2">
                          <span className="text-sm text-ink">{entry.label}</span>
                          <span className="text-sm font-semibold text-ocean">{entry.value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="streams" className="rounded-[34px] border border-ocean/10 bg-white/82 p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-3xl font-semibold text-ink">Ultime live passate</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" asChild>
                  <Link href="/admin/streams">Apri tabella completa</Link>
                </Button>
                <Button asChild>
                  <Link href="/admin/streams/new">Nuova stream</Link>
                </Button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-[28px] border border-ocean/10">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[minmax(0,1.4fr)_180px_120px_120px] gap-4 bg-ocean/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ocean/70">
                  <span>Titolo</span>
                  <span>Data</span>
                  <span>Domande</span>
                  <span>Azioni</span>
                </div>
                {recentPastStreams.length ? (
                  recentPastStreams.map((stream) => (
                    <div
                      key={stream.id}
                      className="grid grid-cols-[minmax(0,1.4fr)_180px_120px_120px] gap-4 border-t border-ocean/10 bg-white px-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{stream.title}</p>
                        <p className="mt-1 truncate text-sm text-ink/55">{stream.embedUrl}</p>
                      </div>
                      <p className="text-sm text-ink/65">{stream.scheduledAt ? formatDateTime(stream.scheduledAt) : "Conclusa"}</p>
                      <p className="text-sm font-semibold text-ink">{stream.questionsCount}</p>
                      <div>
                        <Button variant="secondary" asChild>
                          <Link href={`/admin/streams/${stream.id}`}>Apri</Link>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white px-4 py-8 text-sm text-ink/60">Nessuna live passata disponibile.</div>
                )}
              </div>
            </div>
          </section>
      </div>

      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-3 xl:right-[calc(var(--admin-sidebar-width)+1.5rem)]"
      >
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`pointer-events-auto rounded-[24px] border px-4 py-3 shadow-2xl backdrop-blur ${getNotificationToneClasses(notification.tone)}`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-ocean/10 p-2 text-ocean">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{notification.title}</p>
                {notification.description ? <p className="mt-1 text-sm text-ink/65">{notification.description}</p> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
