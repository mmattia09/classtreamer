"use client";

/** Mini bar-chart row */
export function EntryBar({ label, value, total, max }: { label: string; value: number; total: number; max: number }) {
  const widthPct = max > 0 ? Math.round((value / max) * 100) : 0;
  const sharePct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="max-w-[55%] truncate text-xs text-foreground">{label}</span>
        <span className="shrink-0 text-xs text-muted">{value} <span className="text-muted/60">({sharePct}%)</span></span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

