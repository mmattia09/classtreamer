import Link from "next/link";
import { ChevronRight, MessageSquare, Plus, Radio } from "lucide-react";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Record<string, number> = { LIVE: 0, SCHEDULED: 1, DRAFT: 2, ENDED: 3 };
const STATUS_LABELS: Record<string, string> = { LIVE: "Live", SCHEDULED: "Programmata", DRAFT: "Bozza", ENDED: "Conclusa" };
const STATUS_VARIANTS: Record<string, "live" | "warning" | "secondary" | "default"> = {
  LIVE: "live",
  SCHEDULED: "warning",
  DRAFT: "secondary",
  ENDED: "default",
};

export default async function StreamsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");

  const [streams, settings] = await Promise.all([
    prisma.stream.findMany({
      include: { _count: { select: { questions: true } } },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    }),
    getAppSettings(),
  ]);

  const appConfig = buildAppConfig(settings);
  const sorted = [...streams].sort((a, b) => {
    const so = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (so !== 0) return so;
    const da = a.scheduledAt?.getTime() ?? a.createdAt.getTime();
    const db = b.scheduledAt?.getTime() ?? b.createdAt.getTime();
    return db - da;
  });

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stream</h1>
          <p className="mt-0.5 text-sm text-muted">Tutte le live, bozze e archivio.</p>
        </div>
        <Button asChild>
          <Link href="/admin/streams/new">
            <Plus className="h-4 w-4" />
            Nuova stream
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">Nessuna stream disponibile.</p>
        ) : (
          sorted.map((stream) => (
            <Link
              key={stream.id}
              href={`/admin/streams/${stream.id}`}
              className="group flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors border-b border-border last:border-0"
            >
              {/* Status indicator dot */}
              {stream.status === "LIVE" && (
                <Radio className="h-3.5 w-3.5 shrink-0 text-success animate-pulse" />
              )}

              {/* Title */}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground group-hover:text-accent transition-colors truncate">
                  {stream.title}
                </p>
              </div>

              {/* Status badge */}
              <Badge variant={STATUS_VARIANTS[stream.status] ?? "secondary"} className="shrink-0">
                {STATUS_LABELS[stream.status] ?? stream.status}
              </Badge>

              {/* Date */}
              <span className="hidden md:block w-36 shrink-0 text-sm text-muted tabular-nums">
                {stream.scheduledAt
                  ? formatDateTime(stream.scheduledAt.toISOString())
                  : formatDateTime(stream.createdAt.toISOString())}
              </span>

              {/* Question count */}
              <span className="hidden sm:flex w-24 shrink-0 items-center gap-1 text-sm text-muted">
                <MessageSquare className="h-3.5 w-3.5" />
                {stream._count.questions}
              </span>

              {/* Navigation arrow */}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-accent transition-colors" />
            </Link>
          ))
        )}
      </Card>
    </AdminShell>
  );
}
