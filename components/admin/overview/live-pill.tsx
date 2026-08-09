"use client";

import { Badge } from "@/components/ui/badge";
import { formatLiveElapsed } from "@/components/admin/overview/format";
import { useClock } from "@/lib/use-clock";
import type { StreamStatusResponse } from "@/lib/types";

export function LivePill({ status, startedAt }: { status: StreamStatusResponse["status"]; startedAt?: string | null }) {
  const clock = useClock();
  const now = status === "live" && startedAt ? clock : null;

  if (status === "live") {
    return (
      <Badge variant="live" className="gap-1.5 tabular-nums">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Live{now !== null && startedAt ? ` · ${formatLiveElapsed(startedAt, now)}` : ""}
      </Badge>
    );
  }
  if (status === "scheduled") return <Badge variant="warning">Programmata</Badge>;
  return <Badge variant="secondary">Offline</Badge>;
}

