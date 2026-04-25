"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock } from "lucide-react";

import { QuestionInput } from "@/components/question-input";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import { formatTimerRemaining, getQuestionTimerState } from "@/lib/question-timer";
import { getSocket } from "@/lib/socket-client";
import type { QuestionPayload } from "@/lib/types";

export function AnswerPageClient({
  initialQuestion,
  appName,
}: {
  initialQuestion: QuestionPayload | null;
  appName: string;
}) {
  const [connected, setConnected] = useState(false);
  const [question, setQuestion] = useState(initialQuestion);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onQuestionPush = (p: QuestionPayload) => {
      setQuestion(p.audienceType === "INDIVIDUAL" ? p : null);
      setSubmitted(false);
      setSubmitError(null);
    };
    const onQuestionUpdate = (p: QuestionPayload) => {
      setQuestion((current) => {
        if (current?.id !== p.id) return current;
        return p.audienceType === "INDIVIDUAL" ? p : null;
      });
    };
    const onQuestionClose = () => {
      setQuestion(null);
      setSubmitted(false);
      setSubmitError(null);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("question:push", onQuestionPush);
    socket.on("question:update", onQuestionUpdate);
    socket.on("question:close", onQuestionClose);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("question:push", onQuestionPush);
      socket.off("question:update", onQuestionUpdate);
      socket.off("question:close", onQuestionClose);
    };
  }, []);

  useEffect(() => {
    setClockNow(Date.now());
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const timerState = useMemo(
    () => getQuestionTimerState(question, clockNow),
    [question, clockNow],
  );

  async function submitAnswer(value: unknown) {
    if (!question) return;
    setSubmitError(null);
    const response = await fetch(`/api/questions/${question.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (response.ok) {
      setSubmitted(true);
      return;
    }

    const payload = await response.json().catch(() => null) as { error?: string } | null;
    setSubmitError(payload?.error ?? "Impossibile inviare la risposta.");
    if (response.status === 410) {
      setClockNow(Date.now());
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-5">
          <span className="text-sm font-semibold text-foreground">{appName}</span>
          <StatusDot connected={connected} />
        </div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        <div className="w-full max-w-lg">
          {!question && (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised">
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
              </div>
              <p className="text-base font-medium text-foreground">Nessuna domanda attiva</p>
            </div>
          )}

          {question && submitted && (
            <div className="rounded-xl border border-success/20 bg-success-subtle p-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-12 w-12 text-success-foreground" />
              <p className="text-base font-semibold text-success-foreground">Risposta inviata</p>
              <p className="mt-1 text-sm text-success-foreground/70">Attendi la prossima domanda</p>
            </div>
          )}

          {question && !submitted && (
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm space-y-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                      timerState.kind === "active"
                        ? timerState.remainingSeconds > 30
                          ? "bg-success-subtle text-success-foreground"
                          : timerState.remainingSeconds > 10
                            ? "bg-warning-subtle text-warning-foreground"
                            : "bg-destructive-subtle text-destructive-foreground"
                        : timerState.kind === "expired"
                          ? "bg-destructive-subtle text-destructive-foreground"
                          : "bg-surface-raised text-muted",
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {timerState.kind === "active"
                      ? formatTimerRemaining(timerState.remainingSeconds)
                      : timerState.kind === "expired"
                        ? "Tempo scaduto"
                        : timerState.kind === "pending"
                          ? "Timer in avvio"
                          : "Senza timer"}
                  </div>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">Domanda</p>
                <h2 className="text-xl font-semibold text-foreground leading-snug">{question.text}</h2>
              </div>
              {submitError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive-foreground">
                  {submitError}
                </div>
              ) : null}
              {timerState.kind === "expired" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-foreground">
                  Il tempo per rispondere e&apos; terminato.
                </div>
              ) : (
                <QuestionInput question={question} onSubmit={submitAnswer} />
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
