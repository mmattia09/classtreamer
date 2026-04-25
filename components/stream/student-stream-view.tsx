"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, SendHorizontal, X } from "lucide-react";
import QRCode from "qrcode";

import { QuestionInput } from "@/components/question-input";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type Props = {
  year: number;
  section: string;
  initialStatus: StreamStatusResponse;
  initialQuestion: QuestionPayload | null;
  initialResults: ResultsPayload | null;
  baseUrl: string;
};

type ViewerQuestionContentState = "compact" | "expanded" | "none";

const VIEWER_QUESTION_CONTENT_SWAP_DELAY_MS = 140;
const VIEWER_QUESTION_CONTAINER_TRANSITION_MS = 300;

export function StudentStreamView({
  year,
  section,
  initialStatus,
  initialQuestion,
  initialResults,
  baseUrl,
}: Props) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [question, setQuestion] = useState<QuestionPayload | null>(initialQuestion);
  const [answersCount, setAnswersCount] = useState(initialResults?.totalAnswers ?? 0);
  const [submitted, setSubmitted] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [viewerQuestionExpanded, setViewerQuestionExpanded] = useState(false);
  const [viewerQuestionContentState, setViewerQuestionContentState] =
    useState<ViewerQuestionContentState>("compact");
  const [viewerQuestionText, setViewerQuestionText] = useState("");
  const [viewerQuestionSubmitting, setViewerQuestionSubmitting] = useState(false);
  const [viewerQuestionFeedback, setViewerQuestionFeedback] = useState("");
  const [viewerQuestionSuccess, setViewerQuestionSuccess] = useState(false);
  const [viewerQuestionNoLiveError, setViewerQuestionNoLiveError] = useState(false);
  const questionRef = useRef<QuestionPayload | null>(initialQuestion);
  const viewerQuestionContentTimeoutRef = useRef<number | null>(null);
  const answerUrl = useMemo(() => new URL("/answer", `${baseUrl}/`).toString(), [baseUrl]);

  useEffect(() => {
    localStorage.setItem("classtreamer-class", JSON.stringify({ year, section }));
  }, [year, section]);

  useEffect(() => {
    QRCode.toDataURL(answerUrl, { width: 320, margin: 1 }).then(setQrDataUrl);
  }, [answerUrl]);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      socket.emit("viewer:join", { year, section }, (response: { ok?: boolean } | undefined) => {
        if (response?.ok === false) socket.disconnect();
      });
    }
    function onDisconnect() { setConnected(false); }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("stream:status", setStatus);
    socket.on("question:push", (payload: QuestionPayload) => {
      setQuestion(payload);
      setSubmitted(false);
    });
    socket.on("question:update", (payload: QuestionPayload) => {
      setQuestion((current) => (current?.id === payload.id ? payload : current));
    });
    socket.on("question:close", () => { setQuestion(null); setSubmitted(false); });
    socket.on("results:update", (payload: ResultsPayload) => setAnswersCount(payload.totalAnswers));

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("stream:status", setStatus);
      socket.off("question:push");
      socket.off("question:update");
      socket.off("question:close");
      socket.off("results:update");
    };
  }, [year, section]);

  useEffect(() => { questionRef.current = question; }, [question]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/streams/current?year=${year}&section=${section}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as StreamStatusResponse;
        setStatus(payload);
      } catch {
        // Network error — keep last known state
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [year, section]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch("/api/questions/active", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { question: QuestionPayload | null; results: ResultsPayload | null };
        const current = questionRef.current;
        if (
          payload.question?.id !== current?.id ||
          payload.question?.timerSeconds !== current?.timerSeconds ||
          payload.question?.openedAt !== current?.openedAt
        ) {
          setQuestion(payload.question);
          if (payload.question?.id !== current?.id) {
            setSubmitted(false);
          }
        }
        if (!payload.question && current) { setQuestion(null); setSubmitted(false); }
        if (payload.results) setAnswersCount(payload.results.totalAnswers);
      } catch {
        // Network error — keep last known state
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status.status !== "live") return;
    const element = document.documentElement;
    if ("requestFullscreen" in element && !document.fullscreenElement) {
      element.requestFullscreen?.().catch(() => undefined);
    }
  }, [status]);

  useEffect(() => {
    if (!question?.timerSeconds || !question.openedAt) { setCountdown(null); return; }
    const tick = () => {
      const expiresAt = new Date(question.openedAt!).getTime() + question.timerSeconds! * 1000;
      setCountdown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [question]);

  useEffect(() => {
    if (!viewerQuestionSuccess && !viewerQuestionNoLiveError) return;
    const timeout = setTimeout(() => {
      setViewerQuestionSuccess(false);
      setViewerQuestionNoLiveError(false);
    }, 1800);
    return () => clearTimeout(timeout);
  }, [viewerQuestionSuccess, viewerQuestionNoLiveError]);

  useEffect(() => {
    return () => {
      if (viewerQuestionContentTimeoutRef.current !== null)
        window.clearTimeout(viewerQuestionContentTimeoutRef.current);
    };
  }, []);

  function clearViewerQuestionAnimationTimeouts() {
    if (viewerQuestionContentTimeoutRef.current !== null) {
      window.clearTimeout(viewerQuestionContentTimeoutRef.current);
      viewerQuestionContentTimeoutRef.current = null;
    }
  }

  function openViewerQuestion() {
    clearViewerQuestionAnimationTimeouts();
    setViewerQuestionExpanded(true);
    setViewerQuestionContentState("none");
    setViewerQuestionFeedback("");
    setViewerQuestionSuccess(false);
    setViewerQuestionNoLiveError(false);
    viewerQuestionContentTimeoutRef.current = window.setTimeout(() => {
      setViewerQuestionContentState("expanded");
      viewerQuestionContentTimeoutRef.current = null;
    }, VIEWER_QUESTION_CONTENT_SWAP_DELAY_MS);
  }

  function closeViewerQuestion() {
    clearViewerQuestionAnimationTimeouts();
    setViewerQuestionExpanded(false);
    setViewerQuestionContentState("compact");
    setViewerQuestionFeedback("");
  }

  const showQuestionPanel = useMemo(() => {
    if (!question) return false;
    if (question.audienceType === "INDIVIDUAL") return true;
    if (submitted) return false;
    if (countdown !== null && countdown <= 0) return false;
    return true;
  }, [question, submitted, countdown]);

  async function submitAnswer(value: unknown) {
    if (!question) return;
    try {
      const response = await fetch(`/api/questions/${question.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classYear: year, classSection: section, value }),
      });
      if (response.ok) {
        setSubmitted(true);
      }
    } catch {
      // Network error — user can retry
    }
  }

  async function submitViewerQuestion() {
    const text = viewerQuestionText.trim();
    if (!text || viewerQuestionSubmitting) return;

    setViewerQuestionSubmitting(true);
    setViewerQuestionFeedback("");

    try {
      const streamId = status.status === "live" ? status.streamId : null;
      const response = await fetch("/api/audience-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, classYear: year, classSection: section, streamId }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setViewerQuestionFeedback(
            retryAfter ? `Troppi invii. Riprova tra ${retryAfter}s.` : "Troppi invii ravvicinati.",
          );
          return;
        }
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        const errorMessage = payload?.error ?? "Invio non riuscito.";
        if (errorMessage === "Nessuna live attiva") {
          closeViewerQuestion();
          setViewerQuestionFeedback("");
          setViewerQuestionNoLiveError(true);
          return;
        }
        setViewerQuestionFeedback(errorMessage);
        return;
      }

      setViewerQuestionText("");
      closeViewerQuestion();
      setViewerQuestionFeedback("");
      setViewerQuestionSuccess(true);
      setViewerQuestionNoLiveError(false);
    } finally {
      setViewerQuestionSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-zinc-950">
      {/* ── Full-screen content ── */}
      <section className="fixed inset-0 z-0 flex overflow-hidden">
        {/* Main stream area */}
        <div className="relative h-full flex-1">
          {/* Overlay controls */}
          <div className="absolute left-4 right-4 top-4 z-20 flex items-center justify-between gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:bg-black/60"
            >
              <ArrowLeft className="h-4 w-4" />
              {getYearLabel(year)}{section}
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-sm font-medium text-white backdrop-blur-md">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-success" : "bg-destructive"}`}
              />
              {connected ? "Connesso" : "Riconnessione..."}
            </div>
          </div>

          {/* No stream */}
          {status.status === "no_stream" ? (
            <div className="flex h-full flex-col items-center justify-center p-10 text-center">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/30">Classtreamer</p>
              <h2 className="text-3xl font-semibold text-white/80">Nessuna stream programmata</h2>
            </div>
          ) : null}

          {/* Scheduled */}
          {status.status === "scheduled" ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 p-10 text-center">
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute h-5 w-5 animate-ping rounded-full bg-warning/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning" />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">In arrivo</p>
                <h2 className="text-4xl font-semibold text-white">{status.title}</h2>
                <p className="mt-2 text-lg text-white/50">{formatDateTime(status.scheduledAt)}</p>
              </div>
            </div>
          ) : null}

          {/* Live embed */}
          {status.status === "live" ? (
            <iframe src={status.embedUrl} className="h-full w-full" allow="fullscreen; autoplay" />
          ) : null}
        </div>

        {/* ── Question panel ── */}
        <aside
          className={`h-full overflow-hidden border-white/10 bg-background/95 backdrop-blur-sm transition-[width,opacity] duration-500 ease-out ${
            showQuestionPanel
              ? "w-[380px] border-l opacity-100"
              : "pointer-events-none w-0 border-l-0 opacity-0"
          }`}
        >
          {/* CLASS audience */}
          {question?.audienceType === "CLASS" ? (
            <div className="flex h-full flex-col p-6">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                    Domanda attiva
                  </p>
                  <h2 className="text-xl font-semibold leading-snug text-foreground">{question.text}</h2>
                </div>
                {countdown !== null ? (
                  <div className="shrink-0 rounded-full border border-warning/30 bg-warning/10 px-3 py-1">
                    <span className="tabular-nums text-sm font-semibold text-warning-foreground">{countdown}s</span>
                  </div>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto">
                <QuestionInput question={question} onSubmit={submitAnswer} />
              </div>
            </div>
          ) : null}

          {/* INDIVIDUAL audience */}
          {question?.audienceType === "INDIVIDUAL" ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="mb-4 text-[10px] font-semibold uppercase tracking-widest text-muted">
                Partecipa dal telefono
              </p>
              <h2 className="mb-6 text-2xl font-semibold text-foreground">{question.text}</h2>
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="QR code per rispondere"
                  width={220}
                  height={220}
                  unoptimized
                  className="w-56 rounded-2xl border border-border bg-white p-3 shadow-md"
                />
              ) : null}
              <p className="mt-5 break-all rounded-lg bg-surface-raised px-3 py-2 font-mono text-xs text-muted">
                {answerUrl}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span>
                  <strong className="font-semibold text-foreground">{answersCount}</strong> risposte ricevute
                </span>
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      {/* ── Viewer question floating pill ── */}
      <div
        className={`pointer-events-none fixed bottom-6 z-40 flex justify-center px-4 transition-[left,right] duration-500 ease-out ${
          showQuestionPanel ? "left-0 right-[380px]" : "inset-x-0"
        }`}
      >
        <div className="pointer-events-auto flex w-full flex-col items-center">
          <div
            className={`relative overflow-hidden border border-white/10 bg-black/60 shadow-xl backdrop-blur-md transition-[width,height,border-radius] duration-300 ease-out ${
              viewerQuestionExpanded ? "h-[64px] rounded-[24px]" : "h-11 rounded-full"
            }`}
            style={{ width: viewerQuestionExpanded ? "min(44rem, 100%)" : "192px" }}
          >
            {/* Compact trigger */}
            <button
              type="button"
              onClick={openViewerQuestion}
              className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full text-sm font-medium text-white/80 transition-opacity duration-200 ${
                viewerQuestionContentState === "compact"
                  ? "opacity-100"
                  : "pointer-events-none opacity-0"
              }`}
              style={{
                transitionDelay:
                  viewerQuestionContentState === "compact" && !viewerQuestionExpanded
                    ? `${VIEWER_QUESTION_CONTAINER_TRANSITION_MS}ms`
                    : "0ms",
              }}
            >
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  viewerQuestionSuccess || viewerQuestionNoLiveError ? "opacity-0" : "opacity-100"
                }`}
              >
                Fai una domanda
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  viewerQuestionSuccess ? "opacity-100" : "opacity-0"
                }`}
              >
                <Check className="h-4 w-4 text-success" />
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center gap-2 text-destructive transition-opacity duration-300 ${
                  viewerQuestionNoLiveError ? "opacity-100" : "opacity-0"
                }`}
              >
                <X className="h-4 w-4" />
                Nessuna live attiva
              </span>
            </button>

            {/* Expanded form */}
            <form
              onSubmit={(e) => { e.preventDefault(); void submitViewerQuestion(); }}
              className={`absolute inset-0 flex items-center gap-2 px-3 transition-[opacity,transform] duration-300 ${
                viewerQuestionContentState === "expanded"
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-2 opacity-0"
              }`}
            >
              <input
                value={viewerQuestionText}
                onChange={(e) => setViewerQuestionText(e.target.value)}
                placeholder="La tua domanda..."
                className="h-10 flex-1 rounded-full bg-white/10 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-white/20"
                maxLength={280}
              />
              <button
                type="button"
                onClick={closeViewerQuestion}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60 transition-colors hover:bg-white/20"
                aria-label="Chiudi"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={viewerQuestionSubmitting || !viewerQuestionText.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 transition-all hover:-translate-y-px disabled:pointer-events-none disabled:opacity-40"
                aria-label="Invia domanda"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </div>

          {viewerQuestionFeedback ? (
            <p className="mt-2 rounded-full bg-black/50 px-3 py-1 text-xs text-destructive">
              {viewerQuestionFeedback}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
