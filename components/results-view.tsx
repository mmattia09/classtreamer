"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ResultsPayload } from "@/lib/types";

const PIE_COLORS = ["#6576F6", "#FF6B5F", "#1A2B6B", "#8A97FF", "#F0B34A", "#4BC9B0"];
const WORD_CLOUD_POSITIONS = [
  { top: "10%", left: "44%" },
  { top: "22%", left: "25%" },
  { top: "28%", left: "63%" },
  { top: "42%", left: "48%" },
  { top: "58%", left: "22%" },
  { top: "60%", left: "68%" },
  { top: "74%", left: "46%" },
  { top: "18%", left: "74%" },
  { top: "78%", left: "74%" },
  { top: "36%", left: "8%" },
  { top: "54%", left: "84%" },
  { top: "8%", left: "12%" },
];

function formatAverageLabel(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return value.toFixed(1);
}

function getFeaturedOpenAnswer(results: ResultsPayload, featuredAnswerId?: string | null) {
  const submissions = results.latestSubmissions ?? [];
  if (!submissions.length) {
    return null;
  }

  return submissions.find((entry) => entry.id === featuredAnswerId) ?? submissions[0];
}

function getSecondaryOpenAnswers(results: ResultsPayload, featuredAnswerId?: string | null) {
  const submissions = results.latestSubmissions ?? [];
  return submissions.filter((entry) => entry.id !== (featuredAnswerId ?? submissions[0]?.id)).slice(0, 8);
}

function renderWordCloud(results: ResultsPayload, transparent: boolean) {
  const maxValue = Math.max(...results.entries.map((entry) => entry.value), 1);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-[36px] bg-white/6">
      {results.entries.slice(0, 12).map((entry, index) => {
        const position = WORD_CLOUD_POSITIONS[index % WORD_CLOUD_POSITIONS.length];
        const fontSize = 1.1 + (entry.value / maxValue) * 3.2;
        const palette = index % 2 === 0 ? (transparent ? "#EEF2FF" : "#6576F6") : transparent ? "#FFD8D2" : "#FF6B5F";

        return (
          <span
            key={entry.label}
            className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-medium leading-none"
            style={{
              top: position.top,
              left: position.left,
              fontSize: `${fontSize}rem`,
              color: palette,
              opacity: 0.95,
            }}
          >
            {entry.label}
          </span>
        );
      })}
    </div>
  );
}

export function ResultsView({
  questionText,
  results,
  transparent = false,
  featuredAnswerId,
}: {
  questionText?: string;
  results: ResultsPayload;
  transparent?: boolean;
  featuredAnswerId?: string | null;
}) {
  const surfaceClass = transparent
    ? "border-white/14 bg-[linear-gradient(180deg,rgba(7,18,30,0.78),rgba(14,31,53,0.72))] text-white"
    : "bg-white text-ink border-ocean/10";
  const mutedText = transparent ? "text-white/65" : "text-ink/55";
  const accentText = transparent ? "text-white" : "text-ink";
  const scaleMin = results.scale?.min ?? 1;
  const scaleMax = results.scale?.max ?? 5;
  const safeAverage = results.average ?? scaleMin;
  const averagePosition = ((safeAverage - scaleMin) / Math.max(scaleMax - scaleMin, 1)) * 100;

  return (
    <div
      className={`flex h-full min-h-0 flex-col rounded-[40px] border p-8 shadow-[0_28px_90px_rgba(3,9,20,0.3)] backdrop-blur-md ${surfaceClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-5xl">
          <p className={`text-sm uppercase tracking-[0.22em] ${mutedText}`}>Risultati live</p>
          <h1 className={`mt-4 text-5xl font-semibold leading-tight ${accentText}`}>{questionText ?? results.questionText ?? "Domanda"}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className={`rounded-full px-5 py-3 text-right ${transparent ? "bg-white/8" : "bg-white/10"}`}>
            <p className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Risposte</p>
            <p className="mt-1 text-3xl font-semibold">{results.totalAnswers}</p>
          </div>
          {results.type === "SCALE" ? (
            <div className={`rounded-full px-5 py-3 text-right ${transparent ? "bg-white/8" : "bg-white/10"}`}>
              <p className={`text-xs uppercase tracking-[0.18em] ${mutedText}`}>Media</p>
              <p className="mt-1 text-3xl font-semibold">{formatAverageLabel(results.average)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 min-h-0 flex-1">
        {results.type === "OPEN" ? (
          <div className="grid h-full gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className={`flex min-h-[320px] items-center rounded-[36px] border p-8 text-4xl leading-tight ${surfaceClass}`}>
              <p>{getFeaturedOpenAnswer(results, featuredAnswerId)?.value ?? "Nessuna risposta selezionata."}</p>
            </div>
            <div className="grid auto-rows-fr gap-3">
              {getSecondaryOpenAnswers(results, featuredAnswerId).length ? (
                getSecondaryOpenAnswers(results, featuredAnswerId).map((entry) => (
                  <div key={entry.id} className={`rounded-[24px] border px-4 py-3 text-lg ${surfaceClass}`}>
                    <p>{entry.value}</p>
                    {entry.classLabel ? <p className={`mt-2 text-sm ${mutedText}`}>{entry.classLabel}</p> : null}
                  </div>
                ))
              ) : (
                <div className={`rounded-[24px] border px-4 py-3 text-lg ${surfaceClass}`}>Nessun’altra risposta disponibile.</div>
              )}
            </div>
          </div>
        ) : null}

        {results.type === "WORD_COUNT" ? renderWordCloud(results, transparent) : null}

        {results.type === "SCALE" ? (
          <div className="grid h-full gap-6 xl:grid-rows-[auto_1fr]">
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
              <span className={`text-lg ${mutedText}`}>{results.scale?.min ?? 1}</span>
              <div className="relative h-3 rounded-full bg-white/15">
                <div className="absolute inset-y-0 left-0 rounded-full bg-[#6576F6]" style={{ width: `${averagePosition}%` }} />
                <div
                  className="absolute top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#6576F6] text-center text-sm font-semibold leading-[3rem] text-white shadow-lg"
                  style={{ left: `${averagePosition}%` }}
                >
                  {formatAverageLabel(results.average)}
                </div>
              </div>
              <span className={`text-lg ${mutedText}`}>{results.scale?.max ?? 5}</span>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={results.entries} margin={{ top: 24, right: 24, bottom: 24, left: 12 }}>
                  <defs>
                    <linearGradient id="scaleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#AAB5FF" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#AAB5FF" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke={transparent ? "#ffffff" : "#6576F6"} />
                  <YAxis allowDecimals={false} stroke={transparent ? "#ffffff" : "#6576F6"} />
                  <Tooltip
                    contentStyle={{ borderRadius: 18, border: "none", background: transparent ? "rgba(15,23,42,0.92)" : "#fff" }}
                    labelStyle={{ color: "#6576F6" }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#6576F6" strokeWidth={4} fill="url(#scaleGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {results.type === "SINGLE_CHOICE" ? (
          <div className="grid h-full gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] xl:items-center">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={results.entries}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="48%"
                    outerRadius="80%"
                    paddingAngle={3}
                  >
                    {results.entries.map((entry, index) => (
                      <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 18, border: "none", background: transparent ? "rgba(15,23,42,0.92)" : "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {results.entries.map((entry, index) => (
                <div key={entry.label} className={`flex items-center justify-between rounded-[24px] border px-4 py-4 ${surfaceClass}`}>
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-lg">{entry.label}</span>
                  </div>
                  <span className={`text-lg font-semibold ${accentText}`}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {results.type === "MULTIPLE_CHOICE" ? (
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.entries} margin={{ top: 18, right: 18, bottom: 36, left: 18 }}>
                <XAxis dataKey="label" stroke={transparent ? "#ffffff" : "#6576F6"} />
                <YAxis allowDecimals={false} stroke={transparent ? "#ffffff" : "#6576F6"} />
                <Tooltip contentStyle={{ borderRadius: 18, border: "none", background: transparent ? "rgba(15,23,42,0.92)" : "#fff" }} />
                <Bar dataKey="value" fill="#6576F6" radius={[16, 16, 0, 0]} maxBarSize={120} animationDuration={250} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}
