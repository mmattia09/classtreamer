"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import type { ResultsPayload } from "@/lib/types";

export function ResultsView({ results, transparent = false }: { results: ResultsPayload; transparent?: boolean }) {
  const labelFill = transparent ? "#ffffff" : "rgb(var(--app-main))";
  const mutedTextColor = transparent ? "text-white/80" : "text-ocean";

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
            className={`rounded-full px-4 py-2 font-semibold ${transparent ? "bg-white/15 text-white" : "bg-ocean/10 text-ocean"}`}
            style={{ fontSize: `${Math.max(1, entry.value) * 0.3 + 1}rem` }}
          >
            {entry.label}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="h-[360px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={results.entries} layout="vertical" margin={{ top: 8, right: 44, bottom: 8, left: 16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={transparent ? "rgba(255,255,255,0.18)" : "rgb(var(--app-main) / 0.12)"}
          />
          <XAxis type="number" allowDecimals={false} stroke={transparent ? "#fff" : "rgb(var(--app-main))"} />
          <YAxis dataKey="label" type="category" width={120} stroke={transparent ? "#fff" : "rgb(var(--app-main))"} />
          <Tooltip
            cursor={{ fill: transparent ? "rgba(255,255,255,0.08)" : "rgb(var(--app-main) / 0.05)" }}
            contentStyle={{
              borderRadius: 16,
              border: "none",
              background: transparent ? "rgba(11, 20, 34, 0.92)" : "rgba(255, 255, 255, 0.96)",
            }}
            labelStyle={{ color: transparent ? "#fff" : "rgb(var(--app-main))" }}
            itemStyle={{ color: transparent ? "#fff" : "rgb(var(--app-main))" }}
          />
          <Bar
            dataKey="value"
            fill={transparent ? "rgb(var(--app-light))" : "rgb(var(--app-main))"}
            radius={[0, 12, 12, 0]}
            animationDuration={400}
          >
            <LabelList
              dataKey="value"
              position="right"
              offset={10}
              fill={labelFill}
              fontSize={14}
              fontWeight={700}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {(results.type === "SINGLE_CHOICE" || results.type === "MULTIPLE_CHOICE") && transparent ? (
        <p className={`mt-3 text-center text-sm ${mutedTextColor}`}>Valori mostrati come numero di selezioni.</p>
      ) : null}
    </div>
  );
}
