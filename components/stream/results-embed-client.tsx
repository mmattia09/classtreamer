"use client";

import { useEffect, useState } from "react";

import { ResultsView } from "@/components/results-view";
import { getYearLabel } from "@/lib/classes";
import { getSocket } from "@/lib/socket-client";
import type { EmbedPayload } from "@/lib/types";

const EMBED_STAGE_CLASS =
  "relative min-h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(101,118,246,0.28),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(255,107,95,0.18),transparent_24%),linear-gradient(180deg,#091523_0%,#0d1f35_52%,#132b4b_100%)]";

const EMBED_STAGE_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.1),transparent_28%,transparent_72%,rgba(255,255,255,0.08))]";

export function ResultsEmbedClient({
  initialEmbed,
}: {
  initialEmbed: EmbedPayload;
}) {
  const [embed, setEmbed] = useState(initialEmbed);

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousBodyBackgroundImage = document.body.style.backgroundImage;
    const previousHtmlBackground = document.documentElement.style.background;

    document.body.style.background = "transparent";
    document.body.style.backgroundImage = "none";
    document.documentElement.style.background = "transparent";

    const socket = getSocket();
    const refresh = async () => {
      const response = await fetch("/api/embed/state", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      setEmbed((await response.json()) as EmbedPayload);
    };

    socket.on("question:push", refresh);
    socket.on("question:close", refresh);
    socket.on("results:update", refresh);
    socket.on("viewer-question:new", refresh);
    socket.on("embed:update", (payload: EmbedPayload) => setEmbed(payload));

    return () => {
      document.body.style.background = previousBodyBackground;
      document.body.style.backgroundImage = previousBodyBackgroundImage;
      document.documentElement.style.background = previousHtmlBackground;
      socket.off("question:push");
      socket.off("question:close");
      socket.off("results:update");
      socket.off("viewer-question:new");
      socket.off("embed:update");
    };
  }, []);

  if (embed.kind === "none") {
    return <div className={EMBED_STAGE_CLASS} />;
  }

  if (embed.kind === "viewer-question") {
    return (
      <main className={`${EMBED_STAGE_CLASS} flex items-center justify-center p-8 text-white`}>
        <div className={EMBED_STAGE_OVERLAY_CLASS} />
        <div className="relative w-full max-w-5xl rounded-[40px] border border-white/18 bg-[linear-gradient(135deg,rgba(8,20,34,0.78),rgba(18,43,75,0.68))] p-10 shadow-[0_28px_80px_rgba(3,9,20,0.4)] backdrop-blur-md">
          <p className="text-sm uppercase tracking-[0.24em] text-white/60">Domanda dal pubblico</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">{embed.viewerQuestion.text}</h1>
          <p className="mt-6 text-xl text-white/70">
            {embed.viewerQuestion.classYear === null || !embed.viewerQuestion.classSection
              ? "Pubblico"
              : `${getYearLabel(embed.viewerQuestion.classYear)}${embed.viewerQuestion.classSection}`}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={`${EMBED_STAGE_CLASS} p-6 text-white`}>
      <div className={EMBED_STAGE_OVERLAY_CLASS} />
      <div className="relative h-[calc(100vh-3rem)]">
        <ResultsView
          questionText={embed.question.text}
          results={embed.results}
          transparent
          featuredAnswerId={embed.featuredAnswerId ?? null}
        />
      </div>
    </main>
  );
}
