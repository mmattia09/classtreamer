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
    QRCode.toDataURL(answerUrl, {
      width: 360,
      margin: 1,
    }).then(setQrDataUrl);
  }, [answerUrl]);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setConnected(true);
      socket.emit("viewer:join", { year, section }, (response: { ok?: boolean } | undefined) => {
        if (response?.ok === false) {
          socket.disconnect();
        }
      });
    }

    function onDisconnect() {
      setConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("stream:status", setStatus);
    socket.on("question:push", (payload: QuestionPayload) => {
      setQuestion(payload);
      setSubmitted(false);
    });
    socket.on("question:close", () => {
      setQuestion(null);
      setSubmitted(false);
    });
    socket.on("results:update", (payload: ResultsPayload) => {
      setAnswersCount(payload.totalAnswers);
    });

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("stream:status", setStatus);
      socket.off("question:push");
      socket.off("question:close");
      socket.off("results:update");
    };
  }, [year, section]);

  useEffect(() => {
    questionRef.current = question;
  }, [question]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/streams/current?year=${year}&section=${section}`, { cache: "no-store" });
      const payload = (await response.json()) as StreamStatusResponse;
      setStatus(payload);
    }, 5000);

    return () => clearInterval(interval);
  }, [year, section]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch("/api/questions/active", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { question: QuestionPayload | null; results: ResultsPayload | null };
      const current = questionRef.current;
      if (payload.question?.id !== current?.id) {
        setQuestion(payload.question);
        setSubmitted(false);
      }
      if (!payload.question && current) {
        setQuestion(null);
        setSubmitted(false);
      }
      if (payload.results) {
        setAnswersCount(payload.results.totalAnswers);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status.status !== "live") {
      return;
    }

    const element = document.documentElement;
    const canFullscreen = "requestFullscreen" in element;
    if (canFullscreen && !document.fullscreenElement) {
      element.requestFullscreen?.().catch(() => undefined);
    }
  }, [status]);

  useEffect(() => {
    if (!question?.timerSeconds || !question.openedAt) {
      setCountdown(null);
      return;
    }

    const tick = () => {
      const expiresAt = new Date(question.openedAt!).getTime() + question.timerSeconds! * 1000;
      setCountdown(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [question]);

  useEffect(() => {
    if (!viewerQuestionSuccess && !viewerQuestionNoLiveError) {
      return;
    }

    const timeout = setTimeout(() => {
      setViewerQuestionSuccess(false);
      setViewerQuestionNoLiveError(false);
    }, 1800);

    return () => clearTimeout(timeout);
  }, [viewerQuestionSuccess, viewerQuestionNoLiveError]);

  useEffect(() => {
    return () => {
      if (viewerQuestionContentTimeoutRef.current !== null) {
        window.clearTimeout(viewerQuestionContentTimeoutRef.current);
      }
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
    if (!question) {
      return false;
    }
    if (question.audienceType === "INDIVIDUAL") {
      return true;
    }
    if (submitted) {
      return false;
    }
    if (countdown !== null && countdown <= 0) {
      return false;
    }
    return true;
  }, [question, submitted, countdown]);

  async function submitAnswer(value: unknown) {
    if (!question) {
      return;
    }

    await fetch(`/api/questions/${question.id}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        classYear: year,
        classSection: section,
        value,
      }),
    });

    setSubmitted(true);
  }

  async function submitViewerQuestion() {
    const text = viewerQuestionText.trim();
    if (!text || viewerQuestionSubmitting) {
      return;
    }

    setViewerQuestionSubmitting(true);
    setViewerQuestionFeedback("");

    try {
      const streamId = status.status === "live" ? status.streamId : null;
      const response = await fetch("/api/audience-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          classYear: year,
          classSection: section,
          streamId,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          setViewerQuestionFeedback(
            retryAfter
              ? `Troppi invii. Riprova tra ${retryAfter} secondi.`
              : "Troppi invii ravvicinati.",
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
    <main className="relative min-h-screen bg-ink">
      <section className="fixed inset-0 z-0 flex overflow-hidden">
        <div className="relative h-full flex-1">
          <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-ink shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Classe {getYearLabel(year)}
              {section}
            </Link>
            <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-ink shadow-soft">
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-sage" : "bg-terracotta"}`} />
              {connected ? "Connesso" : "Riconnessione..."}
            </div>
          </div>
          {status.status === "no_stream" ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-3xl font-semibold text-white">
              Nessuna stream programmata attualmente
            </div>
          ) : null}

          {status.status === "scheduled" ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-10 text-center text-white">
              <div className="h-5 w-5 animate-pulseSoft rounded-full bg-gold" />
              <h2 className="text-4xl font-semibold">La stream andrà in onda a breve</h2>
              <p className="text-xl text-white/80">{status.title}</p>
              <p className="text-lg text-white/70">{formatDateTime(status.scheduledAt)}</p>
            </div>
          ) : null}

          {status.status === "live" ? (
            <iframe src={status.embedUrl} className="h-full w-full" allow="fullscreen; autoplay" />
          ) : null}
        </div>

        <aside
          className={`h-full overflow-hidden bg-white/95 shadow-2xl transition-[width,transform,opacity] duration-500 ease-out ${
            showQuestionPanel
              ? "w-1/3 translate-x-0 border-l border-white/10 p-6 opacity-100"
              : "pointer-events-none w-0 translate-x-full border-l-0 p-0 opacity-0"
          }`}
        >
          {question?.audienceType === "CLASS" ? (
            <div className="flex h-full flex-col">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.16em] text-ocean/70">Domanda attiva</p>
                  <h2 className="text-2xl font-semibold">{question.text}</h2>
                </div>
                {countdown !== null ? (
                  <span className="rounded-full bg-gold/20 px-3 py-1 text-sm font-semibold text-ocean">
                    {countdown}s
                  </span>
                ) : null}
              </div>
              <div className="flex-1 overflow-y-auto">
                <QuestionInput question={question} onSubmit={submitAnswer} />
              </div>
            </div>
          ) : null}

          {question?.audienceType === "INDIVIDUAL" ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">Partecipa dal telefono</p>
              <h2 className="mt-3 text-3xl font-semibold text-ink">{question.text}</h2>
              {qrDataUrl ? (
                <Image
                  src={qrDataUrl}
                  alt="QR code per rispondere"
                  width={288}
                  height={288}
                  unoptimized
                  className="mt-8 w-72 rounded-[28px] border border-ocean/10 bg-white p-4 shadow-soft"
                />
              ) : null}
              <p className="mt-6 break-all rounded-2xl bg-ocean/5 px-4 py-3 text-lg text-ink/70">{answerUrl}</p>
              <p className="mt-4 text-xl font-semibold text-ocean">Risposte ricevute: {answersCount}</p>
            </div>
          ) : null}
        </aside>
      </section>

      <div
        className={`pointer-events-none fixed bottom-6 z-40 flex justify-center px-4 transition-[left,right] duration-500 ease-out ${
          showQuestionPanel ? "left-0 right-[33.333333%]" : "inset-x-0"
        }`}
      >
        <div className="pointer-events-auto flex w-full flex-col items-center">
          <div
            className={`relative overflow-hidden bg-white shadow-2xl transition-[width,height,border-radius,padding] duration-300 ease-out ${
              viewerQuestionExpanded
                ? "h-[72px] rounded-[30px] p-3"
                : "h-14 rounded-full p-0"
            }`}
            style={{ width: viewerQuestionExpanded ? "min(48rem, 100%)" : "230px" }}
          >
            <button
              type="button"
              onClick={openViewerQuestion}
              className={`absolute inset-0 flex items-center justify-center overflow-hidden rounded-full px-6 text-sm font-semibold text-ocean transition-opacity duration-200 ${
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
                Fai una domanda →
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  viewerQuestionSuccess ? "opacity-100" : "opacity-0"
                }`}
              >
                <Check className="h-5 w-5" />
              </span>
              <span
                className={`absolute inset-0 flex items-center justify-center gap-2 whitespace-nowrap text-terracotta transition-opacity duration-300 ${
                  viewerQuestionNoLiveError ? "opacity-100" : "opacity-0"
                }`}
              >
                <X className="h-5 w-5" />
                <span>Nessuna live attiva</span>
              </span>
              <span className="opacity-0">Fai una domanda →</span>
            </button>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitViewerQuestion();
              }}
              className={`absolute inset-0 flex items-center gap-3 p-3 transition-[opacity,transform] duration-300 ${
                viewerQuestionContentState === "expanded"
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-2 opacity-0"
              }`}
            >
              <input
                value={viewerQuestionText}
                onChange={(event) => setViewerQuestionText(event.target.value)}
                placeholder="Scrivi qui la tua domanda"
                className="h-12 flex-1 rounded-full bg-transparent px-5 text-base text-ink outline-none ring-ocean/20 transition focus:ring-4"
                maxLength={280}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeViewerQuestion}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
                  aria-label="Chiudi"
                >
                  <X className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={viewerQuestionSubmitting || !viewerQuestionText.trim()}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-ocean text-white shadow-soft transition-transform duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
                  aria-label="Invia domanda"
                >
                  <SendHorizontal className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>

          {viewerQuestionFeedback ? (
            <p className="mt-2 px-5 text-sm text-terracotta">{viewerQuestionFeedback}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
