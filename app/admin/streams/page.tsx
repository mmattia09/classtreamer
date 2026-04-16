import Link from "next/link";
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
          <Link href="/admin/streams/new">Nuova stream</Link>
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Titolo</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Stato</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Data</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">Domande</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.length ? (
                sorted.map((stream) => (
                  <tr key={stream.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{stream.title}</p>
                      <p className="text-xs text-muted font-mono">{stream.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[stream.status] ?? "secondary"}>
                        {STATUS_LABELS[stream.status] ?? stream.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {stream.scheduledAt
                        ? formatDateTime(stream.scheduledAt.toISOString())
                        : formatDateTime(stream.createdAt.toISOString())}
                    </td>
                    <td className="px-4 py-3 text-muted">{stream._count.questions}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" asChild>
                          <Link href={`/admin/streams/${stream.id}`}>
                            {stream.status === "ENDED" ? "Storico" : "Modifica"}
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={`/api/admin/streams/${stream.id}/export`}>CSV</a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                    Nessuna stream disponibile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
