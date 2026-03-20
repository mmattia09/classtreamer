"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { CurrentStreamSummary, QuestionArchiveEntry, StreamSummary, ViewerQuestionSummary } from "@/lib/admin-data";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse, ViewerQuestionPayload } from "@/lib/types";
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
  viewerQuestions: ViewerQuestionSummary[];
};

type QuestionDraft = {
  text: string;
  inputType: string;
  audienceType: string;
  timerSeconds: number;
  options: string;
};

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

function formatViewerQuestionClassLabel(entry: ViewerQuestionPayload) {
  if (entry.classYear === null || !entry.classSection) {
    return "Pubblico";
  }

  return `${getYearLabel(entry.classYear)}${entry.classSection}`;
}

export function AdminOverview({
  initialOverview,
  initialClasses,
  focusSection,
}: {
  initialOverview: OverviewPayload;
  initialClasses: ClassesEntry[];
  focusSection?: string;
}) {
  const [streamStatus, setStreamStatus] = useState(initialOverview.streamStatus);
  const [currentStream, setCurrentStream] = useState<CurrentStreamSummary | null>(initialOverview.currentStream);
  const [streams, setStreams] = useState(initialOverview.streams);
  const [questionArchive, setQuestionArchive] = useState(initialOverview.questionArchive);
  const [activeQuestion, setActiveQuestion] = useState(initialOverview.activeQuestion);
  const [results, setResults] = useState(initialOverview.results);
  const [classes, setClasses] = useState(initialClasses);
  const [viewerCounts, setViewerCounts] = useState<ViewerCount[]>([]);
  const [viewerQuestions, setViewerQuestions] = useState(initialOverview.viewerQuestions);
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
  const [isPending, startTransition] = useTransition();
  const selectedQuestionRef = useRef(selectedQuestionId);

  useEffect(() => {
    selectedQuestionRef.current = selectedQuestionId;
  }, [selectedQuestionId]);

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
      setViewerQuestions(payload.viewerQuestions);
      setActiveQuestion(payload.activeQuestion);
      setResults(payload.results);
    });
  }

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join");
    socket.on("viewer:count", (payload: ViewerCount[]) => setViewerCounts(payload));
    socket.on("classes:update", (payload: ClassesEntry[]) => setClasses(payload));
    socket.on("viewer-question:new", (payload: ViewerQuestionPayload) => {
      setViewerQuestions((current) => [payload, ...current.filter((entry) => entry.id !== payload.id)].slice(0, 20));
    });
    socket.on("results:update", (payload: ResultsPayload) => {
      setResults(payload);
      if (selectedQuestionRef.current === payload.questionId) {
        setSelectedResults(payload);
      }
    });
    socket.on("question:push", (payload: QuestionPayload) => {
      setActiveQuestion(payload);
      if (!selectedQuestionRef.current) {
        setSelectedQuestionId(payload.id);
      }
      void refreshOverview();
    });
    socket.on("question:close", () => {
      setActiveQuestion(null);
      setResults(null);
      if (selectedQuestionRef.current === activeQuestion?.id) {
        setSelectedResults(null);
      }
      void refreshOverview();
    });
    socket.on("stream:status", (payload: StreamStatusResponse) => {
      setStreamStatus(payload);
      void refreshOverview();
    });

    return () => {
      socket.off("viewer:count");
      socket.off("classes:update");
      socket.off("viewer-question:new");
      socket.off("results:update");
      socket.off("question:push");
      socket.off("question:close");
      socket.off("stream:status");
    };
  }, [activeQuestion?.id]);

  useEffect(() => {
    if (selectedQuestionId && results?.questionId === selectedQuestionId) {
      setSelectedResults(results);
    }
  }, [results, selectedQuestionId]);

  useEffect(() => {
    if (!selectedQuestionId) {
      setSelectedResults(null);
      return;
    }
    if (results?.questionId === selectedQuestionId) {
      setSelectedResults(results);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/admin/questions/${selectedQuestionId}/summary`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (payload?.results) {
          setSelectedResults(payload.results as ResultsPayload);
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

  const viewerMap = useMemo(() => {
    const map = new Map<string, ViewerCount>();
    viewerCounts.forEach((entry) => map.set(`${entry.year}-${entry.section}`, entry));
    return map;
  }, [viewerCounts]);

  const sortedClasses = useMemo(() => [...classes].sort(sortClassEntries), [classes]);
  const disconnectedClasses = sortedClasses.filter((entry) => !viewerMap.has(`${entry.year}-${entry.section}`));
  const connectedClasses = sortedClasses.filter((entry) => viewerMap.has(`${entry.year}-${entry.section}`));

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

  const liveStream = streamStatus.status === "live" ? streamStatus : null;
  const scheduledStream = streamStatus.status === "scheduled" ? streamStatus : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Area amministrativa</p>
          <h1 className="text-3xl font-semibold text-ink">Dashboard live</h1>
          <p className="mt-1 text-ink/65">Gestisci stream, domande e classi connesse in tempo reale.</p>
        </div>
        <Button asChild>
          <Link href="/admin/streams/new">Nuova stream</Link>
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-ocean/10 bg-white/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Gestione live</h2>
                <p className="text-sm text-ink/60">Stato attuale e comandi rapidi.</p>
              </div>
              {liveStream ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" asChild>
                    <Link href={`/admin/streams/${liveStream.streamId}`}>Modifica</Link>
                  </Button>
                  <Button variant="danger" onClick={() => runAction(`/api/admin/streams/${liveStream.streamId}/end`)}>
                    Termina live
                  </Button>
                </div>
              ) : null}
            </div>

            {streamStatus.status === "no_stream" ? (
              <div className="mt-5 space-y-4">
                <p className="text-lg text-ink/70">Nessuna stream programmata o attiva.</p>
                {streams.drafts.length ? (
                  <div className="space-y-2">
                    {streams.drafts.map((stream) => (
                      <div key={stream.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ocean/10 bg-white/70 px-4 py-3">
                        <div>
                          <p className="font-semibold">{stream.title}</p>
                          <p className="text-xs text-ink/60">Bozza pronta alla programmazione.</p>
                        </div>
                        <Button variant="secondary" asChild>
                          <Link href={`/admin/streams/${stream.id}`}>Completa</Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink/60">Crea una nuova stream per iniziare.</p>
                )}
              </div>
            ) : null}

            {scheduledStream ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-ocean/10 bg-white px-5 py-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">Prossima live</p>
                  <p className="text-2xl font-semibold">{scheduledStream.title}</p>
                  <p className="text-ink/65">{scheduledStream.scheduledAt ? formatDateTime(scheduledStream.scheduledAt) : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => runAction(`/api/admin/streams/${scheduledStream.streamId}/live`)}>
                    Vai live
                  </Button>
                  <Button variant="secondary" asChild>
                    <Link href={`/admin/streams/${scheduledStream.streamId}`}>Modifica</Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {liveStream ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="overflow-hidden rounded-3xl bg-ink">
                  <iframe src={liveStream.embedUrl} className="min-h-[280px] w-full" allow="fullscreen; autoplay" />
                </div>
                <div className="flex flex-col justify-between gap-4 rounded-3xl border border-ocean/10 bg-white/80 p-5">
                  <div>
                    <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">Live attiva</p>
                    <p className="text-2xl font-semibold">{liveStream.title}</p>
                  </div>
                  <div className="space-y-2">
                    {activeQuestion ? (
                      <a
                        href={`/api/admin/questions/${activeQuestion.id}/export`}
                        className="inline-flex w-full items-center justify-center rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
                      >
                        Scarica risposte domanda attiva
                      </a>
                    ) : null}
                    <a
                      href={`/api/admin/streams/${liveStream.streamId}/export`}
                      className="inline-flex w-full items-center justify-center rounded-2xl border border-ocean/20 bg-white px-4 py-3 text-sm font-semibold text-ocean"
                    >
                      Scarica risposte stream
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section id="streams" className="rounded-3xl border border-ocean/10 bg-white/80 p-6">
            <h2 className="text-2xl font-semibold">Programmazione stream</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Prossime live</h3>
                {streams.upcoming.length ? (
                  streams.upcoming.map((stream) => (
                    <div key={stream.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ocean/10 bg-white/70 px-4 py-3">
                      <div>
                        <p className="font-semibold">{stream.title}</p>
                        <p className="text-sm text-ink/60">{stream.scheduledAt ? formatDateTime(stream.scheduledAt) : ""}</p>
                      </div>
                      <Button variant="secondary" asChild>
                        <Link href={`/admin/streams/${stream.id}`}>Gestisci</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">Nessuna live programmata.</p>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Archivio live</h3>
                {streams.past.length ? (
                  streams.past.map((stream) => (
                    <div key={stream.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ocean/10 bg-white/70 px-4 py-3">
                      <div>
                        <p className="font-semibold">{stream.title}</p>
                        <p className="text-sm text-ink/60">{stream.scheduledAt ? formatDateTime(stream.scheduledAt) : ""}</p>
                      </div>
                      <a
                        href={`/api/admin/streams/${stream.id}/export`}
                        className="inline-flex items-center justify-center rounded-2xl border border-ocean/20 bg-white px-4 py-2 text-sm font-semibold text-ocean"
                      >
                        Scarica CSV
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink/60">Nessuna live archiviata.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-ocean/10 bg-white/80 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Gestione domande</h2>
                <p className="text-sm text-ink/60">Domande live, programmate e archivio completo.</p>
              </div>
              {error ? <p className="text-sm text-terracotta">{error}</p> : null}
            </div>

            <div className="mt-5 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Domande attive</h3>
                    {activeQuestion ? (
                      <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-ocean">Live</span>
                    ) : null}
                  </div>
                  {activeQuestions.length ? (
                    activeQuestions.map((question) => (
                      <div
                        key={question.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                          selectedQuestionId === question.id
                            ? "border-ocean/30 bg-ocean/5"
                            : "border-ocean/10 bg-white/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionId(question.id)}
                          className="text-left"
                        >
                          <p className="font-semibold">{question.text}</p>
                          <p className="text-xs text-ink/60">
                            {question.inputType} · {question.audienceType} · {question.status}
                          </p>
                        </button>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => runAction(`/api/admin/questions/${question.id}/results`)}>
                            Risultati
                          </Button>
                          <Button variant="ghost" onClick={() => runAction(`/api/admin/questions/${question.id}/close`)}>
                            Chiudi
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink/60">Nessuna domanda live al momento.</p>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Domande programmate</h3>
                  {scheduledQuestions.length ? (
                    scheduledQuestions.map((question) => (
                      <div
                        key={question.id}
                        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                          selectedQuestionId === question.id
                            ? "border-ocean/30 bg-ocean/5"
                            : "border-ocean/10 bg-white/70"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedQuestionId(question.id)}
                          className="text-left"
                        >
                          <p className="font-semibold">{question.text}</p>
                          <p className="text-xs text-ink/60">
                            {question.inputType} · {question.audienceType}
                          </p>
                        </button>
                        <Button onClick={() => runAction(`/api/admin/questions/${question.id}/live`)}>Vai live</Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink/60">Nessuna domanda programmata.</p>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border border-ocean/10 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Invia domanda live</h3>
                    <span className="text-xs text-ink/50">Solo con live attiva</span>
                  </div>
                  <input
                    value={questionDraft.text}
                    onChange={(event) => setQuestionDraft((current) => ({ ...current, text: event.target.value }))}
                    placeholder="Testo domanda"
                    className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                    disabled={!liveStream}
                  />
                  <div className="grid gap-3 md:grid-cols-3">
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
                  <Button onClick={handleCreateLiveQuestion} disabled={!liveStream || isPending}>
                    Invia domanda
                  </Button>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-ocean/10 bg-white/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Feed risposte</h3>
                  {selectedQuestion ? (
                    <span className="text-xs text-ink/50">Domanda selezionata</span>
                  ) : null}
                </div>
                {selectedQuestion ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{selectedQuestion.text}</p>
                    {"streamTitle" in selectedQuestion && selectedQuestion.streamTitle ? (
                      <p className="text-xs text-ink/50">Stream: {selectedQuestion.streamTitle}</p>
                    ) : null}
                  </div>
                ) : null}
                {!selectedResults ? (
                  <p className="text-sm text-ink/60">Seleziona una domanda per vedere le risposte.</p>
                ) : selectedResults.latestSubmissions?.length ? (
                  <div className="space-y-2">
                    {selectedResults.latestSubmissions.slice(0, 12).map((entry, index) => (
                      <div key={`${entry.value}-${index}`} className="rounded-2xl border border-ocean/10 bg-white px-3 py-2">
                        <p className="text-sm font-medium">{entry.value || "-"}</p>
                        <p className="text-xs text-ink/50">{entry.classLabel ?? "Classe non indicata"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedResults.entries.map((entry) => (
                      <div key={entry.label} className="flex items-center justify-between rounded-2xl border border-ocean/10 bg-white px-3 py-2">
                        <span className="text-sm">{entry.label}</span>
                        <span className="text-sm font-semibold text-ocean">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-semibold">Archivio domande</h3>
              {questionArchive.length ? (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-2">
                  {questionArchive.map((question) => (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setSelectedQuestionId(question.id)}
                      className={`flex w-full flex-col gap-1 rounded-2xl border px-4 py-3 text-left ${
                        selectedQuestionId === question.id ? "border-ocean/30 bg-ocean/5" : "border-ocean/10 bg-white/70"
                      }`}
                    >
                      <span className="font-semibold">{question.text}</span>
                      <span className="text-xs text-ink/60">
                        {question.streamTitle ?? "Stream non disponibile"} · {formatDateTime(question.createdAt)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink/60">Nessuna domanda archiviata.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-ocean/10 bg-white/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">Domande dal pubblico</h2>
                <p className="text-sm text-ink/60">Messaggi inviati dalla pill in basso durante la stream.</p>
              </div>
              <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold text-ocean">
                {viewerQuestions.length}
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {viewerQuestions.length ? (
                viewerQuestions.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-ocean/10 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{formatViewerQuestionClassLabel(entry)}</p>
                      <p className="text-xs text-ink/50">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/80">{entry.text}</p>
                    {entry.streamTitle ? (
                      <p className="mt-2 text-xs text-ink/50">Stream: {entry.streamTitle}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink/50">Nessuna domanda dal pubblico ricevuta.</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-ocean/10 bg-white/80 p-6">
            <h2 className="text-2xl font-semibold">Classi connesse</h2>
            <p className="text-sm text-ink/60">Elenco live con priorità alle classi scollegate.</p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Non connesse</p>
                <div className="mt-2 space-y-2">
                  {disconnectedClasses.length ? (
                    disconnectedClasses.map((entry) => (
                      <div key={`${entry.year}-${entry.section}`} className="flex items-center justify-between rounded-2xl border border-ocean/10 bg-white/70 px-3 py-2">
                        <span className="text-sm font-medium">{formatClassLabel(entry)}</span>
                        <span className="text-xs text-ink/50">Offline</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-ink/50">Nessuna classe scollegata.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Connesse</p>
                <div className="mt-2 space-y-2">
                  {connectedClasses.length ? (
                    connectedClasses.map((entry) => {
                      const key = `${entry.year}-${entry.section}`;
                      const viewer = viewerMap.get(key);
                      return (
                        <div key={key} className="rounded-2xl border border-ocean/10 bg-white/70 px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{formatClassLabel(entry)}</span>
                            <span className="rounded-full bg-ocean/10 px-2 py-0.5 text-xs font-semibold text-ocean">
                              {viewer?.count ?? 0}
                            </span>
                          </div>
                          {viewer?.ips?.length ? (
                            <p className="mt-1 text-xs text-ink/50">IP: {viewer.ips.join(", ")}</p>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-ink/50">Nessuna classe connessa.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
