"use client";

import { useEffect, useState } from "react";

import { ResultsView } from "@/components/results-view";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { EmbedPayload } from "@/lib/types";

/* ── Cinematic background ───────────────────────────────────── */
const BG =
  "absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(129,140,248,0.12),transparent_50%),radial-gradient(ellipse_at_80%_80%,rgba(52,211,153,0.08),transparent_50%),linear-gradient(180deg,#050508_0%,#09090e_60%,#0c0c15_100%)]";

const NOISE =
  "pointer-events-none absolute inset-0 opacity-[0.025] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC42NSIgbnVtT2N0YXZlcz0iMyIgc3RpdGNoVGlsZXM9InN0aXRjaCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNuKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]";

export function ResultsEmbedClient({ initialEmbed }: { initialEmbed: EmbedPayload }) {
  const [embed, setEmbed] = useState(initialEmbed);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.body.style.backgroundImage = "none";
    document.documentElement.style.background = "transparent";
    document.documentElement.classList.remove("dark");

    const socket = getSocket();

    // Only react to explicit embed:update events pushed by the admin.
    // results:update / question:push do NOT auto-change the embed —
    // the admin must press "Manda a embed" (or enable auto-sync).
    socket.on("embed:update", (payload: EmbedPayload) => setEmbed(payload));

    return () => {
      socket.off("embed:update");
    };
  }, []);

  /* ── Empty state ─────────────────────────────────────────── */
  if (embed.kind === "none") {
    return (
      <div className="relative min-h-screen w-screen overflow-hidden">
        <div className={BG} />
      </div>
    );
  }

  /* ── Viewer question ─────────────────────────────────────── */
  if (embed.kind === "viewer-question") {
    const { classYear, classSection, text } = embed.viewerQuestion;
    const classLabel =
      classYear && classSection ? `${getYearLabel(classYear)}${classSection}` : "Pubblico";

    return (
      <div className="relative flex min-h-screen w-screen items-center justify-center overflow-hidden p-12">
        <div className={BG} />
        <div className={NOISE} />

        {/* Glow halo */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(129,140,248,0.06)] blur-3xl" />

        <div className="relative z-10 w-full max-w-5xl animate-fade-in">
          {/* Label chip */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-white/50 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#818CF8] animate-pulse" />
            Domanda dal pubblico
          </div>

          {/* Question text */}
          <h1 className="text-5xl font-bold leading-tight text-white">
            {text}
          </h1>

          {/* Class */}
          <p className="mt-6 text-xl font-medium text-white/40">{classLabel}</p>
        </div>
      </div>
    );
  }

  /* ── Question results ────────────────────────────────────── */
  return (
    <div className="relative flex min-h-screen w-screen flex-col overflow-hidden p-8">
      <div className={BG} />
      <div className={NOISE} />

      {/* Subtle top-accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(129,140,248,0.4)] to-transparent" />

      <div className="relative z-10 flex h-[calc(100vh-4rem)] flex-col">
        <ResultsView
          questionText={embed.question.text}
          results={embed.results}
          transparent
          featuredAnswerId={embed.featuredAnswerId ?? null}
        />
      </div>
    </div>
  );
}
