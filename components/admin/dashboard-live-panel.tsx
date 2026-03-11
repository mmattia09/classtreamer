"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { ResultsPayload } from "@/lib/types";

type ViewerCount = {
  year: number;
  section: string;
  count: number;
  ips: string[];
};

export function DashboardLivePanel({
  initialResults,
}: {
  initialResults: ResultsPayload | null;
}) {
  const [viewerCounts, setViewerCounts] = useState<ViewerCount[]>([]);
  const [results, setResults] = useState(initialResults);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("admin:join");
    socket.on("viewer:count", (payload: ViewerCount[]) => setViewerCounts(payload));
    socket.on("results:update", (payload: ResultsPayload) => setResults(payload));

    return () => {
      socket.off("viewer:count");
      socket.off("results:update");
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4">
        <h3 className="text-xl font-semibold">Classi connesse</h3>
        {viewerCounts.length === 0 ? (
          <p className="text-ink/65">Nessuna aula collegata in questo momento.</p>
        ) : (
          <div className="space-y-3">
            {viewerCounts.map((entry) => (
              <div key={`${entry.year}-${entry.section}`} className="flex items-center justify-between rounded-2xl bg-ocean/5 px-4 py-3">
                <div>
                  <span className="font-medium">
                    Classe {getYearLabel(entry.year)}
                    {entry.section}
                  </span>
                  {entry.ips.length ? (
                    <p className="text-xs text-ink/60">IP: {entry.ips.join(", ")}</p>
                  ) : null}
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-ocean">{entry.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h3 className="text-xl font-semibold">Feed risposte</h3>
        {!results ? (
          <p className="text-ink/65">Nessuna risposta live da mostrare.</p>
        ) : (
          <>
            <p className="text-lg font-medium text-ocean">Totale risposte: {results.totalAnswers}</p>
            {results.latestAnswers?.length ? (
              <div className="space-y-2">
                {results.latestAnswers.slice(0, 8).map((answer, index) => (
                  <div key={`${answer}-${index}`} className="rounded-2xl bg-gold/15 px-4 py-3">
                    {answer}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {results.entries.slice(0, 8).map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between rounded-2xl bg-ocean/5 px-4 py-3">
                    <span>{entry.label}</span>
                    <span className="font-semibold text-ocean">{entry.value}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
