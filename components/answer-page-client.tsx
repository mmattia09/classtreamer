"use client";

import { useEffect, useState } from "react";

import { QuestionInput } from "@/components/question-input";
import { StatusDot } from "@/components/ui/status-dot";
import { Card } from "@/components/ui/card";
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

    function onConnect() {
      setConnected(true);
    }

    function onDisconnect() {
      setConnected(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("question:push", (payload: QuestionPayload) => {
      setQuestion(payload.audienceType === "INDIVIDUAL" ? payload : null);
      setSubmitted(false);
    });
    socket.on("question:close", () => {
      setQuestion(null);
      setSubmitted(false);
    });

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("question:push");
      socket.off("question:close");
    };
  }, []);

  async function submitAnswer(value: unknown) {
    if (!question) {
      return;
    }

    await fetch(`/api/questions/${question.id}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });

    setSubmitted(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
      <Card className="w-full space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">Rispondi ora</p>
            <h1 className="text-3xl font-semibold">{appName}</h1>
          </div>
          <StatusDot connected={connected} />
        </div>

        {!question ? <p className="text-lg text-ink/70">Nessuna domanda attiva al momento</p> : null}

        {question && submitted ? (
          <div className="rounded-3xl bg-sage/15 p-5 text-lg font-medium text-ocean">
            Risposta inviata correttamente.
          </div>
        ) : null}

        {question && !submitted ? (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{question.text}</h2>
            <QuestionInput question={question} onSubmit={submitAnswer} />
          </div>
        ) : null}
      </Card>
    </main>
  );
}
