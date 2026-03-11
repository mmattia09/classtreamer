"use client";

import { cn } from "@/lib/utils";

export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-ink">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full transition-colors",
          connected ? "bg-sage shadow-[0_0_12px_rgba(135,168,120,0.9)]" : "bg-terracotta",
        )}
      />
      {connected ? "Connesso" : "Riconnessione..."}
    </span>
  );
}
