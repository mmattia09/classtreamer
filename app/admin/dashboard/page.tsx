import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { DashboardLivePanel } from "@/components/admin/dashboard-live-panel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isAdminAuthenticated } from "@/lib/auth";
import { getActiveQuestion, getCurrentStreamStatus, getResultsForQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const streamStatus = await getCurrentStreamStatus();
  const streams = await prisma.stream.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  const activeQuestion = await getActiveQuestion();
  const results = activeQuestion ? await getResultsForQuestion(activeQuestion.id) : null;

  return (
    <AdminShell title="Dashboard" subtitle="Controllo rapido della diretta, domande attive e anteprima.">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-2xl font-semibold">Stato corrente</h2>
            <p className="text-lg text-ink/75">
              {streamStatus.status === "no_stream" && "Nessuna stream attiva o programmata"}
              {streamStatus.status === "scheduled" &&
                `Programmato: ${streamStatus.title} - ${formatDateTime(streamStatus.scheduledAt)}`}
              {streamStatus.status === "live" && `In onda: ${streamStatus.title}`}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/admin/streams">Gestisci stream</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/admin/classes">Impostazioni</Link>
              </Button>
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="text-2xl font-semibold">Ultime stream</h2>
            <div className="space-y-3">
              {streams.map((stream) => (
                <div key={stream.id} className="rounded-2xl border border-ocean/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{stream.title}</p>
                      <p className="text-sm text-ink/65">{formatDateTime(stream.scheduledAt)}</p>
                    </div>
                    <span className="rounded-full bg-ocean/10 px-3 py-1 text-sm font-medium text-ocean">
                      {stream.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold">Anteprima visione studenti</h2>
            <a href="/embed/results" target="_blank" className="text-sm font-semibold text-ocean">
              Apri embed risultati
            </a>
          </div>
          {streamStatus.status === "live" ? (
            <iframe src={streamStatus.embedUrl} className="min-h-[320px] w-full rounded-3xl bg-ink" />
          ) : (
            <div className="flex min-h-[320px] items-center justify-center rounded-3xl bg-ink text-xl font-semibold text-white">
              Nessuna diretta live
            </div>
          )}

          {activeQuestion ? (
            <div className="rounded-3xl bg-ocean/5 p-5">
              <p className="text-sm uppercase tracking-[0.18em] text-ocean/70">Domanda attiva</p>
              <h3 className="mt-2 text-2xl font-semibold">{activeQuestion.text}</h3>
              <p className="mt-1 text-ink/70">
                {activeQuestion.audienceType === "CLASS" ? "Risposta per classe" : "Risposta individuale"}
              </p>
              {results ? <p className="mt-3 text-lg font-medium">Risposte ricevute: {results.totalAnswers}</p> : null}
            </div>
          ) : (
            <p className="text-lg text-ink/70">Nessuna domanda live al momento.</p>
          )}
        </Card>
      </div>
      <DashboardLivePanel initialResults={results} />
    </AdminShell>
  );
}
