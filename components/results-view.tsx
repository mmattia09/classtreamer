"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import type { ResultsPayload } from "@/lib/types";

export function ResultsView({ results, transparent = false }: { results: ResultsPayload; transparent?: boolean }) {
  if (results.type === "OPEN") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {results.latestAnswers?.map((entry, index) => (
          <Card
            key={`${entry}-${index}`}
            className={transparent ? "bg-white/15 text-white backdrop-blur-sm" : ""}
          >
            {entry}
          </Card>
        ))}
      </div>
    );
  }

  if (results.type === "WORD_COUNT") {
    return (
      <div className="flex flex-wrap justify-center gap-3">
        {results.entries.map((entry) => (
          <span
            key={entry.label}
            className="rounded-full bg-ocean/10 px-4 py-2 font-semibold text-ocean"
            style={{ fontSize: `${Math.max(1, entry.value) * 0.3 + 1}rem` }}
          >
            {entry.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={results.entries} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={transparent ? "rgba(255,255,255,0.18)" : "rgb(var(--app-main) / 0.12)"}
          />
          <XAxis type="number" stroke={transparent ? "#fff" : "rgb(var(--app-main))"} />
          <YAxis dataKey="label" type="category" width={120} stroke={transparent ? "#fff" : "rgb(var(--app-main))"} />
          <Tooltip />
          <Bar
            dataKey="value"
            fill={transparent ? "rgb(var(--app-light))" : "rgb(var(--app-main))"}
            radius={[0, 12, 12, 0]}
            animationDuration={400}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
