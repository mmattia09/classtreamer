"use client";

import { useEffect, useRef, useState } from "react";

import { ResultsView } from "@/components/results-view";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { EmbedPayload } from "@/lib/types";

/* ── Background ─────────────────────────────────────────────────
   Flat near-black with a single soft accent wash from the bottom.
   Editorial, minimal — no vignettes, no noise, no cards.
------------------------------------------------------------------ */
const BG =
  "absolute inset-0 bg-[linear-gradient(180deg,#07080c_0%,#0a0b12_55%,#0c0d16_100%)]";

const ACCENT_WASH =
  "pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-[radial-gradient(ellipse_at_50%_100%,rgba(99,122,255,0.10),transparent_60%)]";

export function ResultsEmbedClient({ initialEmbed }: { initialEmbed: EmbedPayload }) {
  const [embed, setEmbed] = useState(initialEmbed);
  const currentQuestionIdRef = useRef<string | null>(null);

  // Keep currentQuestionIdRef in sync with embed state
  useEffect(() => {
    currentQuestionIdRef.current = embed.kind === "question" ? embed.question.id : null;
  }, [embed]);

  useEffect(() => {
    document.body.style.background = "transparent";
    document.body.style.backgroundImage = "none";
    document.documentElement.style.background = "transparent";
    document.documentElement.classList.remove("dark");

    const socket = getSocket();
    socket.on("embed:update", (payload: EmbedPayload) => setEmbed(payload));
    socket.on("results:update", (p: { questionId: string }) => {
      if (p.questionId === currentQuestionIdRef.current) {
        void fetch("/api/embed/state", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((fresh: EmbedPayload | null) => {
            if (fresh) setEmbed(fresh);
          });
      }
    });
    return () => {
      socket.off("embed:update");
      socket.off("results:update");
    };
  }, []);

  /* ── Empty ───────────────────────────────────────────────── */
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
      <div className="relative min-h-screen w-screen overflow-hidden">
        <div className={BG} />
        <div className={ACCENT_WASH} />

        <div className="relative z-10 flex min-h-screen items-center px-[6vw] py-16">
          <div className="w-full max-w-[1400px] animate-fade-in">
            {/* Prefix line */}
            <div className="mb-10 flex items-center gap-4">
              <span className="h-px w-14 bg-white/30" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">
                Domanda dal pubblico
              </span>
            </div>

            {/* Question */}
            <p className="font-semibold leading-[1.05] tracking-tight text-white text-[clamp(3rem,5.6vw,6rem)]">
              {text}
            </p>

            {/* Attribution */}
            <p className="mt-14 text-[13px] font-medium uppercase tracking-[0.28em] text-white/40">
              — {classLabel}
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Question results ────────────────────────────────────── */
  return (
    <div className="relative min-h-screen w-screen overflow-hidden">
      <div className={BG} />
      <div className={ACCENT_WASH} />

      <div className="relative z-10 flex min-h-screen flex-col px-[5vw] py-10">
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
