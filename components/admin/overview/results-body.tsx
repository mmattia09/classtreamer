"use client";

import { EntryBar } from "@/components/admin/overview/entry-bar";
import { ScaleChart } from "@/components/results-view";
import type { ResultsPayload } from "@/lib/types";

/** Results panel body — no header, just data */
export function ResultsBody({
  results,
  embedSelectionIds,
  featuredEmbedAnswerId,
  onEmbedSelectionChange,
  onFeaturedChange,
}: {
  results: ResultsPayload;
  embedSelectionIds: string[];
  featuredEmbedAnswerId: string | null;
  onEmbedSelectionChange: (ids: string[]) => void;
  onFeaturedChange: (id: string | null) => void;
}) {
  const hasEntries = results.entries.length > 0;
  const hasSubmissions = (results.latestSubmissions?.length ?? 0) > 0;

  if (hasEntries) {
    const maxVal = Math.max(...results.entries.map((e) => e.value), 1);

    // Compute mean for SCALE
    let mean: number | null = null;
    if (results.type === "SCALE") {
      const totalWeight = results.entries.reduce((s, e) => s + e.value, 0);
      if (totalWeight > 0) {
        mean = results.entries.reduce((s, e) => s + Number(e.label) * e.value, 0) / totalWeight;
      }
    }

    if (results.type === "SCALE") {
      const scaleMin = results.scale?.min ?? 1;
      const scaleMax = results.scale?.max ?? 5;
      return (
        <div className="flex h-full min-h-0 flex-col">
          <ScaleChart
            entries={results.entries}
            average={mean}
            scaleMin={scaleMin}
            scaleMax={scaleMax}
            dark={false}
          />
          <p className="mt-3 text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="space-y-2.5">
          {results.entries.map((e) => (
            <EntryBar key={e.label} label={e.label} value={e.value} total={results.totalAnswers} max={maxVal} />
          ))}
        </div>
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  if (hasSubmissions) {
    const isOpen = ["OPEN", "WORD_COUNT"].includes(results.type);
    return (
      <div className="space-y-1.5">
        {results.latestSubmissions!.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{entry.value || "—"}</p>
              {entry.classLabel && <p className="text-[11px] text-muted">{entry.classLabel}</p>}
            </div>
            {isOpen && (
              <div className="flex shrink-0 items-center gap-2">
                <label title="Includi nell'embed" className="flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={embedSelectionIds.includes(entry.id)}
                    onChange={(e) =>
                      onEmbedSelectionChange(
                        e.target.checked ? [...embedSelectionIds, entry.id] : embedSelectionIds.filter((id) => id !== entry.id),
                      )
                    }
                  />
                  Embed
                </label>
                {results.type === "OPEN" && (
                  <label
                    title={featuredEmbedAnswerId === entry.id ? "Rimuovi dal primo piano" : "Metti in primo piano"}
                    className={`flex cursor-pointer items-center gap-1 text-[11px] transition-colors ${
                      featuredEmbedAnswerId === entry.id ? "text-accent" : "text-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="featured-answer"
                      checked={featuredEmbedAnswerId === entry.id}
                      onChange={() =>
                        onFeaturedChange(featuredEmbedAnswerId === entry.id ? null : entry.id)
                      }
                      onClick={() => {
                        if (featuredEmbedAnswerId === entry.id) onFeaturedChange(null);
                      }}
                    />
                    Featured
                  </label>
                )}
              </div>
            )}
          </div>
        ))}
        <p className="text-right text-xs text-muted">{results.totalAnswers} risposte totali</p>
      </div>
    );
  }

  return <p className="text-sm text-muted">Nessuna risposta ancora.</p>;
}

/* ─── Main component ────────────────────────────────────────────── */

