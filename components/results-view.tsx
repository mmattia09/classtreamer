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
import { useEffect, useRef, useState } from "react";

import type { ResultsPayload } from "@/lib/types";

/* ── Embed palette ──────────────────────────────────────────── */
const ACCENT = "#818CF8"; // indigo-400
const ACCENT2 = "#34D399"; // emerald-400
const ACCENT3 = "#F472B6"; // pink-400
const ACCENT4 = "#FBBF24"; // amber-400
const ACCENT5 = "#60A5FA"; // blue-400

const PIE_COLORS = [ACCENT, ACCENT2, ACCENT3, ACCENT4, ACCENT5, "#A78BFA"];

/* ── Word cloud ─────────────────────────────────────────────── */
const WORD_COLORS = [ACCENT, "#A5B4FC", ACCENT3, "#FCA5A5", ACCENT2, "#86EFAC", ACCENT4, "#FDE68A"];

function AnimatedWordCloud({ entries }: { entries: { label: string; value: number }[] }) {
  const maxVal = Math.max(...entries.map((e) => e.value), 1);
  const sorted = [...entries].sort((a, b) => b.value - a.value).slice(0, 18);

  return (
    <div className="relative flex h-full w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 overflow-hidden px-8 py-6 content-center">
      {sorted.map((entry, idx) => {
        const ratio = entry.value / maxVal;
        const size = 1.2 + ratio * 5;
        const color = WORD_COLORS[idx % WORD_COLORS.length];
        const delay = idx * 80;
        return (
          <span
            key={entry.label}
            className="inline-block animate-word-in font-bold leading-none tracking-tight whitespace-nowrap"
            style={{
              fontSize: `${size}rem`,
              color,
              opacity: 0.2 + ratio * 0.8,
              animationDelay: `${delay}ms`,
              animationFillMode: "both",
            }}
          >
            {entry.label}
          </span>
        );
      })}
    </div>
  );
}

/* ── Scale distribution ─────────────────────────────────────── */
function ScaleDistribution({
  entries,
  average,
  scaleMin,
  scaleMax,
}: {
  entries: { label: string; value: number }[];
  average: number | null | undefined;
  scaleMin: number;
  scaleMax: number;
}) {
  const safeAvg = average ?? scaleMin;
  const avgPos = ((safeAvg - scaleMin) / Math.max(scaleMax - scaleMin, 1)) * 100;

  return (
    <div className="flex h-full flex-col justify-center gap-8">
      {/* Distribution area chart */}
      <div className="h-[52%]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={entries} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="scaleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.85} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 14 }} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "rgba(10,10,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              labelStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}
              itemStyle={{ color: "#fff" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={ACCENT}
              strokeWidth={3}
              fill="url(#scaleGrad)"
              dot={false}
              activeDot={{ r: 6, fill: "#fff", stroke: ACCENT, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Slider */}
      <div className="px-4">
        <div className="relative h-2 rounded-full bg-white/10">
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white/30 transition-all duration-700"
            style={{ width: `${avgPos}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-xl transition-all duration-700"
            style={{
              left: `${avgPos}%`,
              background: ACCENT,
              boxShadow: `0 0 24px ${ACCENT}88`,
            }}
          >
            <span className="text-xl font-bold text-white">{safeAvg.toFixed(1)}</span>
          </div>
        </div>
        <div className="mt-8 flex justify-between text-sm text-white/40">
          <span>{scaleMin}</span>
          <span>{scaleMax}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Horizontal bar chart ────────────────────────────────────── */
function HorizontalBars({
  entries,
  totalAnswers,
}: {
  entries: { label: string; value: number; percentage?: number }[];
  totalAnswers: number;
}) {
  const max = Math.max(...entries.map((e) => e.value), 1);

  return (
    <div className="flex h-full flex-col justify-center gap-3 px-2">
      {entries.map((entry, idx) => {
        const pct = Math.round((entry.value / Math.max(totalAnswers, 1)) * 100);
        const barPct = (entry.value / max) * 100;
        const color = PIE_COLORS[idx % PIE_COLORS.length];
        return (
          <div key={entry.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-medium text-white/90 truncate">{entry.label}</span>
              <div className="flex items-baseline gap-2 shrink-0">
                <span className="text-2xl font-bold text-white">{entry.value}</span>
                <span className="text-sm text-white/50">{pct}%</span>
              </div>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-white/8">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${barPct}%`,
                  background: color,
                  boxShadow: `0 0 12px ${color}66`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Pie chart ───────────────────────────────────────────────── */
function DonutChart({ entries }: { entries: { label: string; value: number }[] }) {
  return (
    <div className="grid h-full gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
      <div className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {PIE_COLORS.map((c, i) => (
                <filter key={i} id={`glow-${i}`}>
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>
            <Pie
              data={entries}
              dataKey="value"
              nameKey="label"
              innerRadius="52%"
              outerRadius="80%"
              paddingAngle={3}
              startAngle={90}
              endAngle={-270}
              animationBegin={0}
              animationDuration={800}
            >
              {entries.map((_, idx) => (
                <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "rgba(10,10,20,0.92)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
              itemStyle={{ color: "#fff" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-3 min-w-[280px]">
        {entries.map((entry, idx) => (
          <div key={entry.label} className="flex items-center gap-3">
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
            />
            <span className="flex-1 text-base text-white/80 truncate">{entry.label}</span>
            <span className="text-lg font-semibold text-white">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Open answers ────────────────────────────────────────────── */
function OpenAnswers({
  results,
  featuredAnswerId,
}: {
  results: ResultsPayload;
  featuredAnswerId?: string | null;
}) {
  const submissions = results.latestSubmissions ?? [];
  const featured = submissions.find((e) => e.id === featuredAnswerId) ?? submissions[0];
  const secondary = submissions.filter((e) => e.id !== (featured?.id ?? null)).slice(0, 6);

  return (
    <div className="grid h-full gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      {/* Featured */}
      <div className="flex min-h-0 items-center rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
        <p className="text-3xl font-medium leading-relaxed text-white">
          {featured?.value ?? "Nessuna risposta selezionata."}
        </p>
        {featured?.classLabel ? (
          <p className="mt-4 self-end text-sm text-white/40">{featured.classLabel}</p>
        ) : null}
      </div>
      {/* Secondary */}
      <div className="flex flex-col gap-2.5 min-h-0 overflow-hidden">
        {secondary.map((entry) => (
          <div key={entry.id} className="flex-1 min-h-0 rounded-xl border border-white/8 bg-white/4 px-4 py-3 backdrop-blur-sm">
            <p className="text-base text-white/80 line-clamp-2">{entry.value}</p>
            {entry.classLabel ? <p className="mt-1 text-xs text-white/35">{entry.classLabel}</p> : null}
          </div>
        ))}
        {!secondary.length && (
          <div className="flex-1 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
            <p className="text-sm text-white/40">Nessun&apos;altra risposta.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main ResultsView ────────────────────────────────────────── */
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

  if (!transparent) {
    // Admin preview mode (light, compact)
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

  // ── Full embed mode (dark, cinematic) ──────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6">
        <h1 className="text-4xl font-bold leading-tight text-white max-w-4xl">{questionLabel}</h1>
        <div className="flex shrink-0 items-center gap-4">
          <div className="rounded-2xl bg-white/8 border border-white/10 px-5 py-3 text-right backdrop-blur-sm">
            <p className="text-xs uppercase tracking-widest text-white/40">Risposte</p>
            <p className="text-4xl font-bold text-white">{results.totalAnswers}</p>
          </div>
          {results.type === "SCALE" && results.average !== null && results.average !== undefined ? (
            <div className="rounded-2xl bg-white/8 border border-white/10 px-5 py-3 text-right backdrop-blur-sm"
              style={{ boxShadow: `0 0 32px ${ACCENT}33` }}>
              <p className="text-xs uppercase tracking-widest text-white/40">Media</p>
              <p className="text-4xl font-bold" style={{ color: ACCENT }}>{results.average.toFixed(1)}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1">
        {results.type === "OPEN" && (
          <OpenAnswers results={results} featuredAnswerId={featuredAnswerId} />
        )}
        {results.type === "WORD_COUNT" && (
          <AnimatedWordCloud entries={results.entries} />
        )}
        {results.type === "SCALE" && (
          <ScaleDistribution
            entries={results.entries}
            average={results.average}
            scaleMin={scaleMin}
            scaleMax={scaleMax}
          />
        )}
        {results.type === "SINGLE_CHOICE" && (
          <DonutChart entries={results.entries} />
        )}
        {results.type === "MULTIPLE_CHOICE" && (
          <HorizontalBars entries={results.entries} totalAnswers={results.totalAnswers} />
        )}
      </div>
    </div>
  );
}
