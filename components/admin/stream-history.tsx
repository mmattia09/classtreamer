"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { ResultsPayload } from "@/lib/types";

const INPUT_TYPE_LABELS: Record<string, string> = {
  OPEN: "Aperta", WORD_COUNT: "Word cloud", SCALE: "Scala",
  SINGLE_CHOICE: "Singola", MULTIPLE_CHOICE: "Multipla",
};
const AUDIENCE_TYPE_LABELS: Record<string, string> = {
  CLASS: "Classe",
  INDIVIDUAL: "Individuale",
};
const QUESTION_STATUS_LABELS: Record<string, string> = {
  LIVE: "In corso", RESULTS: "Risultati", CLOSED: "Chiusa",
};
const QUESTION_STATUS_VARIANTS: Record<string, "live" | "default" | "secondary"> = {
  LIVE: "live", RESULTS: "default", DRAFT: "secondary", CLOSED: "secondary",
};

function formatQuestionMeta(inputType: string, audienceType?: string) {
  const inputLabel = INPUT_TYPE_LABELS[inputType] ?? inputType;
  if (!audienceType) return inputLabel;
  return `${inputLabel} · ${AUDIENCE_TYPE_LABELS[audienceType] ?? audienceType}`;
}

function EntryBar({ label, value, total, max }: { label: string; value: number; total: number; max: number }) {
  const widthPct = max > 0 ? Math.round((value / max) * 100) : 0;
  const sharePct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="max-w-[55%] truncate text-xs text-foreground">{label}</span>
        <span className="shrink-0 text-xs text-muted">
          {value} <span className="text-muted/60">({sharePct}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function ResultsBody({ results }: { results: ResultsPayload }) {
  if (results.entries.length > 0) {
    const maxVal = Math.max(...results.entries.map((e) => e.value), 1);
    let mean: number | null = null;
    if (results.type === "SCALE") {
      const totalWeight = results.entries.reduce((s, e) => s + e.value, 0);
      if (totalWeight > 0)
        mean = results.entries.reduce((s, e) => s + Number(e.label) * e.value, 0) / totalWeight;
    }
    return (
      <div className="space-y-3">
        {mean !== null && (
          <div className="flex items-center gap-2 rounded-lg bg-accent-subtle px-3 py-2">
            <span className="text-xs text-muted">Media</span>
            <span className="text-lg font-bold tabular-nums text-accent">{mean.toFixed(1)}</span>
          </div>
        )}
        <div className="space-y-2.5">
          {results.entries.map((e) => (
            <EntryBar key={e.label} label={e.label} value={e.value} total={results.totalAnswers} max={maxVal} />
          ))}
        </div>
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  if ((results.latestSubmissions?.length ?? 0) > 0) {
    return (
      <div className="space-y-1.5">
        {results.latestSubmissions!.slice(0, 20).map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{entry.value || "—"}</p>
              {entry.classLabel && <p className="text-[11px] text-muted">{entry.classLabel}</p>}
            </div>
          </div>
        ))}
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  return <p className="text-sm text-muted">Nessuna risposta ancora.</p>;
}

export type QuestionHistoryEntry = {
  id: string;
  text: string;
  inputType: string;
  audienceType: string;
  status: string;
  order: number;
  results: ResultsPayload | null;
};

export function StreamHistory({
  questions,
  streamId,
  showExport = false,
}: {
  questions: QuestionHistoryEntry[];
  streamId: string;
  showExport?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(questions[0]?.id ?? null);
  const selected = questions.find((q) => q.id === selectedId) ?? null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground">Storico risposte</p>
        {showExport && (
          <a
            href={`/api/admin/streams/${streamId}/export`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised"
          >
            <Download className="h-3.5 w-3.5" />
            Esporta tutto CSV
          </a>
        )}
      </div>

      {questions.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">Nessuna domanda con risposte.</p>
      ) : (
        <div className="grid divide-y divide-border md:grid-cols-[240px_1fr] md:divide-x md:divide-y-0">
          {/* Left: question list */}
          <div className="max-h-[360px] overflow-y-auto">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setSelectedId(q.id)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised ${
                  selectedId === q.id ? "bg-accent-subtle" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`line-clamp-2 text-sm leading-snug ${
                    selectedId === q.id ? "font-medium text-accent" : "text-foreground"
                  }`}>
                    <span className="mr-1.5 text-xs text-muted">#{idx + 1}</span>
                    {q.text}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatQuestionMeta(q.inputType, q.audienceType)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 mt-0.5">
                  {q.status !== "DRAFT" && (
                    <Badge variant={QUESTION_STATUS_VARIANTS[q.status] ?? "secondary"}>
                      {QUESTION_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  )}
                  {showExport && (
                    <a
                      href={`/api/admin/questions/${q.id}/export`}
                      title="Esporta CSV"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center rounded p-0.5 text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Right: results panel */}
          <div className="p-4">
            {selected ? (
              <>
                <p className="mb-3 text-xs font-medium text-muted">
                  {formatQuestionMeta(selected.inputType, selected.audienceType)}
                  {selected.results && ` · ${selected.results.totalAnswers} risposte`}
                </p>
                <div className="max-h-[320px] overflow-y-auto">
                  {selected.results ? (
                    <ResultsBody results={selected.results} />
                  ) : (
                    <p className="text-sm text-muted">Nessuna risposta.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Seleziona una domanda per vedere i risultati.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
