"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const questionRef = useRef<QuestionPayload | null>(initialQuestion);

  useEffect(() => {
    localStorage.setItem("classtreamer-class", JSON.stringify({ year, section }));
  }, [year, section]);

  useEffect(() => {
    QRCode.toDataURL(`${baseUrl}/answer`, {
      width: 360,
      margin: 1,
    }).then(setQrDataUrl);
  }, [baseUrl]);

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

  const showQuestionPanel = useMemo(() => {
    if (!question || question.audienceType !== "CLASS") {
      return false;
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

  return (
    <main className="relative min-h-screen bg-ink">
      <section className="fixed inset-0 z-0 flex overflow-hidden">
        <div className="relative h-full flex-1">
          <div className="absolute left-6 right-6 top-6 z-20 flex items-center justify-between gap-4">
            <div className="rounded-full bg-white/85 px-4 py-2 text-sm font-semibold text-ink shadow-soft">
              Classe {getYearLabel(year)}
              {section}
            </div>
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
              ? "w-1/3 translate-x-0 opacity-100 border-l border-white/10 p-6"
              : "w-0 translate-x-full opacity-0 pointer-events-none border-l-0 p-0"
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
        </aside>
      </section>

      {question?.audienceType === "INDIVIDUAL" ? (
        <section className="fixed inset-0 z-30 flex items-center justify-center bg-ink/85 px-6">
          <div className="w-full max-w-3xl rounded-[32px] bg-white p-8 text-center shadow-soft">
            <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Partecipa dal telefono</p>
            <h2 className="mt-2 text-3xl font-semibold">{question.text}</h2>
            {qrDataUrl ? (
              <Image
                src={qrDataUrl}
                alt="QR code per rispondere"
                width={288}
                height={288}
                unoptimized
                className="mx-auto mt-6 w-72"
              />
            ) : null}
            <p className="mt-4 text-lg text-ink/70">{baseUrl}/answer</p>
            <p className="mt-3 text-xl font-semibold text-ocean">Risposte ricevute: {answersCount}</p>
          </div>
        </section>
      ) : null}

    </main>
  );
}
