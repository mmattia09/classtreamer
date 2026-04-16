"use client";

import { useEffect, useState } from "react";
import { CheckCircle } from "lucide-react";

import { QuestionInput } from "@/components/question-input";
import { StatusDot } from "@/components/ui/status-dot";
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

  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("question:push", (p: QuestionPayload) => {
      setQuestion(p.audienceType === "INDIVIDUAL" ? p : null);
      setSubmitted(false);
    });
    socket.on("question:close", () => { setQuestion(null); setSubmitted(false); });

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("question:push");
      socket.off("question:close");
    };
  }, []);

  async function submitAnswer(value: unknown) {
    if (!question) return;
    await fetch(`/api/questions/${question.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    setSubmitted(true);
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
              <p className="mt-1 text-sm text-muted">Attendi che il tecnico invii una domanda</p>
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
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">Domanda</p>
                <h2 className="text-xl font-semibold text-foreground leading-snug">{question.text}</h2>
              </div>
              <QuestionInput question={question} onSubmit={submitAnswer} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
