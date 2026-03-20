import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STREAM_STATUS_ORDER: Record<string, number> = {
  LIVE: 0,
  SCHEDULED: 1,
  DRAFT: 2,
  ENDED: 3,
};

const STREAM_STATUS_LABELS: Record<string, string> = {
  LIVE: "Live",
  SCHEDULED: "Programmata",
  DRAFT: "Bozza",
  ENDED: "Conclusa",
};

const STREAM_STATUS_BADGES: Record<string, string> = {
  LIVE: "bg-sage/15 text-sage",
  SCHEDULED: "bg-gold/20 text-ocean",
  DRAFT: "bg-slate-200 text-slate-700",
  ENDED: "bg-ocean/10 text-ocean",
};

function getStreamDateLabel(scheduledAt: string | null, createdAt: string) {
  if (scheduledAt) {
    return formatDateTime(scheduledAt);
  }
  return `Creata il ${formatDateTime(createdAt)}`;
}

export default async function StreamsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [streams, settings] = await Promise.all([
    prisma.stream.findMany({
      include: {
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    }),
    getAppSettings(),
  ]);

  const appConfig = buildAppConfig(settings);
  const sortedStreams = [...streams].sort((a, b) => {
    const statusOrder = (STREAM_STATUS_ORDER[a.status] ?? 99) - (STREAM_STATUS_ORDER[b.status] ?? 99);
    if (statusOrder !== 0) {
      return statusOrder;
    }
    const dateA = a.scheduledAt?.getTime() ?? a.createdAt.getTime();
    const dateB = b.scheduledAt?.getTime() ?? b.createdAt.getTime();
    return dateB - dateA;
  });

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Stream</p>
            <h1 className="text-3xl font-semibold text-ink">Tutte le stream</h1>
            <p className="mt-1 text-ink/65">
              Consulta live, bozze e stream concluse. Da qui puoi aprire lo storico o modificare i dettagli.
            </p>
          </div>
          <Button asChild>
            <Link href="/admin/streams/new">Nuova stream</Link>
          </Button>
        </div>

        <Card className="overflow-hidden p-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ocean/10 text-sm">
              <thead className="bg-white/70 text-left text-xs uppercase tracking-[0.18em] text-ink/55">
                <tr>
                  <th className="px-6 py-4 font-semibold">Titolo</th>
                  <th className="px-6 py-4 font-semibold">Stato</th>
                  <th className="px-6 py-4 font-semibold">Data</th>
                  <th className="px-6 py-4 font-semibold">Domande</th>
                  <th className="px-6 py-4 font-semibold text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ocean/10 bg-white/80">
                {sortedStreams.length ? (
                  sortedStreams.map((stream) => (
                    <tr key={stream.id} className="align-middle">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-ink">{stream.title}</p>
                          <p className="text-xs text-ink/55">{stream.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            STREAM_STATUS_BADGES[stream.status] ?? "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {STREAM_STATUS_LABELS[stream.status] ?? stream.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-ink/70">
                        {getStreamDateLabel(
                          stream.scheduledAt ? stream.scheduledAt.toISOString() : null,
                          stream.createdAt.toISOString(),
                        )}
                      </td>
                      <td className="px-6 py-4 text-ink/70">{stream._count.questions}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" asChild>
                            <Link href={`/admin/streams/${stream.id}`}>
                              {stream.status === "ENDED" ? "Storico" : "Modifica"}
                            </Link>
                          </Button>
                          <Button variant="ghost" asChild>
                            <a href={`/api/admin/streams/${stream.id}/export`}>CSV</a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-ink/60">
                      Nessuna stream disponibile.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
