"use client";

import { useMemo } from "react";
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
import {
  clampFeaturedText,
  featuredAnswerFontVw,
  secondaryAnswerFontVw,
} from "@/lib/overlay-typography";
import { buildWordCloud } from "@/lib/word-cloud";

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
   Word cloud
─────────────────────────────────────────────────────────────── */
function WordCloud({ entries }: { entries: { label: string; value: number }[] }) {
  const items = useMemo(() => buildWordCloud(entries), [entries]);

  if (items.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-[1.6vw] text-white/30">In attesa delle prime risposte…</p>
      </div>
    );
  }

  return (
    // items-center + content-center so the cloud sits in the middle of the
    // available height instead of hugging the top with dead space below.
    <div className="flex h-full w-full flex-wrap items-center justify-center content-center gap-x-[1.7vw] gap-y-[1.1vh] overflow-hidden px-[2vw]">
      {items.map((item, index) => (
        <span
          key={item.label}
          className="inline-block animate-word-in font-bold leading-[1.05] tracking-tight"
          style={{
            fontSize: `${item.fontSize}vw`,
            color: PALETTE[item.colorIndex % PALETTE.length],
            // Larger words carry more of the message, so they read as solid
            // while the long tail recedes.
            opacity: 0.55 + item.weight * 0.45,
            animationDelay: `${Math.min(index * 45, 900)}ms`,
            animationFillMode: "both",
          }}
          title={`${item.label}: ${item.value}`}
        >
          {item.label}
        </span>
      ))}
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
            iconSize={18}
            formatter={(value: string, entry: { payload?: { pct?: number; value?: number } }) => (
              // Viewport-relative: the legend has to be readable from the back
              // of a room, not just on the laptop driving OBS.
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.25vw", lineHeight: 2 }}>
                {value}
                <span style={{ color: "rgba(255,255,255,0.5)", marginLeft: "0.6vw" }}>
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
    // justify-around spreads the rows over the full height rather than leaving
    // a block in the middle with dead space above and below. Sizes are
    // viewport-relative so they hold up on a projector.
    <div className="flex h-full flex-col justify-around gap-[1.5vh] py-[2vh]">
      {entries.map((entry, idx) => {
        const pct = Math.round((entry.value / Math.max(totalAnswers, 1)) * 100);
        const barPct = (entry.value / max) * 100;
        const color = PALETTE[idx % PALETTE.length];
        return (
          <div key={entry.label} className="space-y-[1.2vh]">
            <div className="flex items-baseline justify-between gap-6">
              <span className="truncate text-[1.8vw] font-medium text-white/85">{entry.label}</span>
              <div className="flex shrink-0 items-baseline gap-[0.8vw]">
                <span className="text-[2.6vw] font-bold tabular-nums text-white">{entry.value}</span>
                <span className="text-[1.2vw] font-medium tabular-nums text-white/40">{pct}%</span>
              </div>
            </div>
            <div className="relative h-[0.7vh] overflow-hidden rounded-full bg-white/8">
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

  // Six instead of ten: on a projector, fewer answers set larger beats a dense
  // grid nobody can read from the back of the room.
  const secondary = submissions.filter((e) => e.id !== (featured?.id ?? null)).slice(0, 6);

  const featuredText = featured ? clampFeaturedText(featured.value) : "";
  const featuredVw = featuredAnswerFontVw(featuredText);
  const secondaryVw = secondaryAnswerFontVw(secondary.length);

  if (!featured) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[1.6vw] text-white/30">In attesa delle prime risposte…</p>
      </div>
    );
  }

  return (
    <div
      className={
        secondary.length > 0
          ? "grid h-full min-h-0 gap-[4vw] xl:grid-cols-[1.35fr_0.65fr]"
          : "grid h-full min-h-0"
      }
    >
      {/* Featured answer, sized to its own length so it fills the column
          without ever running past it. */}
      <blockquote className="relative flex min-h-0 flex-col justify-center">
        <span
          className="pointer-events-none absolute -left-[1vw] -top-[3vh] select-none font-serif font-bold leading-none text-white/[0.07]"
          style={{ fontSize: `${featuredVw * 3}vw` }}
          aria-hidden
        >
          &ldquo;
        </span>
        <p
          className="relative font-medium leading-[1.25] tracking-tight text-white"
          style={{ fontSize: `${featuredVw}vw` }}
        >
          {featuredText}
        </p>
        {featured.classLabel && (
          <footer className="relative mt-[2.5vh] flex items-center gap-4 text-white/45">
            <span className="h-px w-[3vw] bg-white/25" />
            <span className="text-[0.85vw] font-semibold uppercase tracking-[0.3em]">
              {featured.classLabel}
            </span>
          </footer>
        )}
      </blockquote>

      {/* Secondary answers — one column, spread over the full height instead of
          a small block stacked at the top. */}
      {secondary.length > 0 && (
        <div className="flex min-h-0 flex-col border-l border-white/[0.07] pl-[2vw]">
          <p className="mb-[2vh] shrink-0 text-[0.8vw] font-semibold uppercase tracking-[0.3em] text-white/35">
            Altre risposte
          </p>
          <ul className="flex min-h-0 flex-1 flex-col justify-around gap-[1vh]">
            {secondary.map((entry) => (
              <li key={entry.id} className="border-b border-white/[0.06] pb-[1.2vh]">
                <p
                  className="leading-[1.35] text-white/80 line-clamp-3"
                  style={{ fontSize: `${secondaryVw}vw` }}
                >
                  {entry.value}
                </p>
                {entry.classLabel && (
                  <p className="mt-[0.5vh] text-[0.75vw] uppercase tracking-wider text-white/30">
                    {entry.classLabel}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
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
