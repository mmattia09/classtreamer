"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";

import type { ResultsPayload } from "@/lib/types";

/* ── Embed palette ────────────────────────────────────────────── */
const ACCENT = "#7C8CFF";
const PALETTE = ["#7C8CFF", "#34D399", "#F472B6", "#FBBF24", "#60A5FA", "#A78BFA"];
const PIE_COLORS = ["#7C8CFF", "#34D399", "#F472B6", "#FBBF24", "#60A5FA", "#A78BFA", "#FB923C", "#2DD4BF"];

/* ───────────────────────────────────────────────────────────────
   ScaleChart — exported, works in dark (embed) and light (admin)
─────────────────────────────────────────────────────────────── */
export function ScaleChart({
  entries,
  average,
  scaleMin,
  scaleMax,
  dark = false,
}: {
  entries: { label: string; value: number }[];
  average: number | null | undefined;
  scaleMin: number;
  scaleMax: number;
  dark?: boolean;
}) {
  const accentColor = dark ? ACCENT : "var(--accent, #003f87)";
  const accentHex = dark ? ACCENT : "#003f87";
  const safeAvg = average ?? scaleMin;
  const avgPos = ((safeAvg - scaleMin) / Math.max(scaleMax - scaleMin, 1)) * 100;

  return (
    <div className={`flex h-full min-h-0 flex-col gap-5 overflow-hidden ${dark ? "justify-center" : ""}`}>
      {/* Area chart */}
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={entries} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id={dark ? "scaleGradDark" : "scaleGradLight"} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentHex} stopOpacity={dark ? 0.7 : 0.5} />
                <stop offset="100%" stopColor={accentHex} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              stroke="transparent"
              tick={{
                fill: dark ? "rgba(255,255,255,0.4)" : "var(--muted-foreground, #6b7280)",
                fontSize: 12,
                fontWeight: 500,
              }}
              axisLine={false}
              tickLine={false}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={accentHex}
              strokeWidth={2.5}
              fill={`url(#${dark ? "scaleGradDark" : "scaleGradLight"})`}
              dot={false}
              activeDot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Track + thumb */}
      <div className="shrink-0 px-2 pb-1">
        <div
          className="relative h-[3px] rounded-full"
          style={{ background: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)" }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            style={{
              width: `${avgPos}%`,
              background: dark ? "rgba(255,255,255,0.20)" : "rgba(0,63,135,0.20)",
            }}
          />
          <div
            className="absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-700"
            style={{
              left: `${avgPos}%`,
              background: accentColor,
              boxShadow: `0 0 32px ${accentHex}55, 0 0 0 5px ${accentHex}22`,
            }}
          >
            <span className="text-sm font-bold tabular-nums text-white">{safeAvg.toFixed(1)}</span>
          </div>
        </div>
        <div
          className="mt-5 flex justify-between text-xs font-medium uppercase tracking-[0.2em]"
          style={{ color: dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)" }}
        >
          <span>{scaleMin}</span>
          <span>{scaleMax}</span>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Word cloud — 3 visual tiers
─────────────────────────────────────────────────────────────── */
function WordCloud({ entries }: { entries: { label: string; value: number }[] }) {
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  const sorted = [...entries].sort((a, b) => b.value - a.value).slice(0, 22);

  const top = sorted.slice(0, 3);
  const mid = sorted.slice(3, 11);
  const rest = sorted.slice(11);

  let colorIdx = 0;
  function nextColor() {
    return PALETTE[colorIdx++ % PALETTE.length];
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-5">
      {/* Tier 1 — big words */}
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {top.map((entry, idx) => {
          const ratio = entry.value / maxVal;
          const size = Math.sqrt(ratio) * 4 + 1.2;
          const color = nextColor();
          return (
            <span
              key={entry.label}
              className="inline-block animate-word-in font-bold leading-none tracking-tight whitespace-nowrap"
              style={{
                fontSize: `${size}rem`,
                color,
                animationDelay: `${idx * 70}ms`,
                animationFillMode: "both",
              }}
            >
              {entry.label}
            </span>
          );
        })}
      </div>

      {/* Tier 2 — mid words with alternating y-offset */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {mid.map((entry, idx) => {
          const ratio = entry.value / maxVal;
          const size = Math.sqrt(ratio) * 4 + 1.2;
          const color = nextColor();
          const yOffset = idx % 2 === 0 ? -6 : 6;
          return (
            <span
              key={entry.label}
              className="inline-block animate-word-in font-bold leading-none tracking-tight whitespace-nowrap"
              style={{
                fontSize: `${size}rem`,
                color,
                transform: `translateY(${yOffset}px)`,
                animationDelay: `${(idx + 3) * 70}ms`,
                animationFillMode: "both",
              }}
            >
              {entry.label}
            </span>
          );
        })}
      </div>

      {/* Tier 3 — small words */}
      {rest.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {rest.map((entry, idx) => {
            const ratio = entry.value / maxVal;
            const size = Math.sqrt(ratio) * 4 + 1.2;
            const color = nextColor();
            return (
              <span
                key={entry.label}
                className="inline-block animate-word-in font-bold leading-none tracking-tight whitespace-nowrap"
                style={{
                  fontSize: `${size}rem`,
                  color,
                  animationDelay: `${(idx + 11) * 70}ms`,
                  animationFillMode: "both",
                }}
              >
                {entry.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   DonutChart — for SINGLE_CHOICE
─────────────────────────────────────────────────────────────── */
function DonutChart({
  entries,
  totalAnswers,
}: {
  entries: { label: string; value: number }[];
  totalAnswers: number;
}) {
  const data = entries.map((e) => ({
    name: e.label,
    value: e.value,
    pct: totalAnswers > 0 ? Math.round((e.value / totalAnswers) * 100) : 0,
  }));

  return (
    <div className="flex h-full items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="40%"
            cy="50%"
            innerRadius="45%"
            outerRadius="72%"
            paddingAngle={2}
            dataKey="value"
            animationDuration={600}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={10}
            formatter={(value: string, entry: { payload?: { pct?: number; value?: number } }) => (
              <span style={{ color: "rgba(255,255,255,0.80)", fontSize: "0.85rem" }}>
                {value}
                <span style={{ color: "rgba(255,255,255,0.45)", marginLeft: "0.4rem" }}>
                  {entry.payload?.pct}%
                </span>
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   HorizontalBars — for MULTIPLE_CHOICE, thin 4px bars
─────────────────────────────────────────────────────────────── */
function HorizontalBars({
  entries,
  totalAnswers,
}: {
  entries: { label: string; value: number }[];
  totalAnswers: number;
}) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-5">
      {entries.map((entry, idx) => {
        const pct = Math.round((entry.value / Math.max(totalAnswers, 1)) * 100);
        const barPct = (entry.value / max) * 100;
        const color = PALETTE[idx % PALETTE.length];
        return (
          <div key={entry.label} className="space-y-2">
            <div className="flex items-baseline justify-between gap-6">
              <span className="truncate text-xl font-medium text-white/85">{entry.label}</span>
              <div className="flex shrink-0 items-baseline gap-3">
                <span className="text-3xl font-bold tabular-nums text-white">{entry.value}</span>
                <span className="text-sm font-medium tabular-nums text-white/40">{pct}%</span>
              </div>
            </div>
            <div className="relative h-[4px] overflow-hidden rounded-full bg-white/8">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{ width: `${barPct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Open answers — editorial quote + 2-col grid
─────────────────────────────────────────────────────────────── */
function OpenAnswers({
  results,
  featuredAnswerId,
}: {
  results: ResultsPayload;
  featuredAnswerId?: string | null;
}) {
  const submissions = results.latestSubmissions ?? [];
  const featured = submissions.find((e) => e.id === featuredAnswerId) ?? submissions[0];
  const secondary = submissions.filter((e) => e.id !== (featured?.id ?? null)).slice(0, 10);

  if (!featured) {
    return (
      <div className="flex h-full items-center">
        <p className="text-lg text-white/35">Nessuna risposta.</p>
      </div>
    );
  }

  return (
    <div className="grid h-full gap-16 xl:grid-cols-[1.15fr_0.85fr]">
      {/* Featured — giant quote */}
      <div className="relative flex flex-col justify-center">
        <div
          className="absolute -left-2 -top-6 select-none font-serif text-[12rem] font-bold leading-none text-white/[0.06]"
          aria-hidden
        >
          &ldquo;
        </div>
        <blockquote className="relative">
          <p className="text-4xl font-medium leading-[1.35] text-white">
            {featured.value}
          </p>
          {featured.classLabel && (
            <footer className="mt-8 flex items-center gap-3 text-white/45">
              <span className="h-px w-10 bg-white/20" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em]">
                {featured.classLabel}
              </span>
            </footer>
          )}
        </blockquote>
      </div>

      {/* Secondary — 2-column grid */}
      <div className="flex min-h-0 flex-col">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
          Altre risposte
        </p>
        <div className="grid grid-cols-2 gap-x-4 divide-y-0">
          {secondary.map((entry) => (
            <div key={entry.id} className="py-2 border-b border-white/[0.06]">
              <p className="text-base leading-relaxed text-white/80 line-clamp-2">{entry.value}</p>
              {entry.classLabel && (
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-white/30">
                  {entry.classLabel}
                </p>
              )}
            </div>
          ))}
          {secondary.length === 0 && (
            <p className="col-span-2 py-4 text-sm text-white/30">Nessun&apos;altra risposta.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Main ResultsView
─────────────────────────────────────────────────────────────── */
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
  const scaleMin = results.scale?.min ?? 1;
  const scaleMax = results.scale?.max ?? 5;
  const questionLabel = questionText ?? results.questionText ?? "Domanda";

  /* ── Admin preview (light, kept for compatibility) ── */
  if (!transparent) {
    return (
      <div className="h-full rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium text-foreground line-clamp-1">{questionLabel}</p>
        <p className="text-xs text-muted">Totale: {results.totalAnswers} risposte</p>
        <div className="mt-3 h-[160px]">
          {results.type === "MULTIPLE_CHOICE" || results.type === "SINGLE_CHOICE" ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.entries} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={300} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : results.type === "SCALE" ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={results.entries} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="previewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} fill="url(#previewGrad)" dot={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              {results.totalAnswers} risposte
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Embed — editorial, card-less ────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      {/* Header — title on the left, Risposte stat on the right */}
      <header className="flex items-end justify-between gap-10 pb-6">
        <div className="min-w-0 flex-1">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
            Domanda in diretta
          </p>
          <h1 className="text-[clamp(2rem,3.2vw,3.4rem)] font-bold leading-[1.1] tracking-tight text-white">
            {questionLabel}
          </h1>
        </div>

        <div className="flex shrink-0 items-end gap-12">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/35">
              Risposte
            </p>
            <p className="mt-1 text-5xl font-bold tabular-nums leading-none text-white">
              {results.totalAnswers}
            </p>
          </div>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px w-full bg-white/8" />

      {/* Content */}
      <main className="mt-10 min-h-0 flex-1">
        {results.type === "OPEN" && (
          <OpenAnswers results={results} featuredAnswerId={featuredAnswerId} />
        )}
        {results.type === "WORD_COUNT" && <WordCloud entries={results.entries} />}
        {results.type === "SCALE" && (
          <ScaleChart
            entries={results.entries}
            average={results.average}
            scaleMin={scaleMin}
            scaleMax={scaleMax}
            dark={true}
          />
        )}
        {results.type === "SINGLE_CHOICE" && (
          <DonutChart entries={results.entries} totalAnswers={results.totalAnswers} />
        )}
        {results.type === "MULTIPLE_CHOICE" && (
          <HorizontalBars entries={results.entries} totalAnswers={results.totalAnswers} />
        )}
      </main>
    </div>
  );
}
