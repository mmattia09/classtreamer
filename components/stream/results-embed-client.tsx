"use client";

import { useEffect, useState } from "react";

import { ResultsView } from "@/components/results-view";
import { getSocket } from "@/lib/socket-client";
import type { QuestionPayload, ResultsPayload } from "@/lib/types";

export function ResultsEmbedClient({
  initialQuestion,
  initialResults,
}: {
  initialQuestion: QuestionPayload | null;
  initialResults: ResultsPayload | null;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [results, setResults] = useState(initialResults);

  useEffect(() => {
    const socket = getSocket();

    socket.on("question:push", (payload: QuestionPayload) => setQuestion(payload));
    socket.on("question:close", () => {
      setQuestion(null);
      setResults(null);
    });
    socket.on("results:update", (payload: ResultsPayload) => setResults(payload));

    return () => {
      socket.off("question:push");
      socket.off("question:close");
      socket.off("results:update");
    };
  }, []);

  if (!question || !question.resultsVisible || !results) {
    return <div className="h-screen w-screen bg-transparent" />;
  }

  return (
    <main className="h-screen w-screen bg-transparent p-6 text-white">
      <ResultsView results={results} transparent />
    </main>
  );
}
