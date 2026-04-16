import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StreamControls } from "@/components/admin/stream-controls";
import { StreamEditor } from "@/components/admin/stream-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const QUESTION_STATUS_VARIANTS: Record<string, "live" | "default" | "secondary"> = {
  LIVE: "live",
  RESULTS: "default",
  DRAFT: "secondary",
  CLOSED: "secondary",
};

const QUESTION_STATUS_LABELS: Record<string, string> = {
  LIVE: "In corso",
  RESULTS: "Risultati",
  DRAFT: "Bozza",
  CLOSED: "Chiusa",
};

const STREAM_STATUS_VARIANTS: Record<string, "live" | "warning" | "secondary"> = {
  LIVE: "live",
  SCHEDULED: "warning",
  DRAFT: "secondary",
  ENDED: "secondary",
};

const STREAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bozza",
  SCHEDULED: "Programmata",
  LIVE: "Live",
  ENDED: "Conclusa",
};

export default async function StreamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin");

  const { id } = await params;
  const [classes, stream, settings] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ year: "asc" }, { section: "asc" }] }),
    prisma.stream.findUnique({
      where: { id },
      include: { targetClasses: true, questions: { orderBy: { order: "asc" } } },
    }),
    getAppSettings(),
  ]);

  if (!stream) notFound();

  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      {/* Page header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-1">
          <Link href="/admin/streams">← Tutte le stream</Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold text-foreground">{stream.title}</h1>
              <Badge variant={STREAM_STATUS_VARIANTS[stream.status] ?? "secondary"}>
                {STREAM_STATUS_LABELS[stream.status] ?? stream.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted">Modifica la live e gestisci le domande preparate.</p>
          </div>
          {stream.status !== "ENDED" && (
            <div className="shrink-0">
              <StreamControls streamId={stream.id} status={stream.status} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <StreamEditor
          classes={classes}
          stream={{
            id: stream.id,
            title: stream.title,
            embedUrl: stream.embedUrl,
            scheduledAt: stream.scheduledAt ? stream.scheduledAt.toISOString().slice(0, 16) : "",
            status: stream.status,
            targetClassIds: stream.targetClasses.map((e) => e.classId),
            questions: stream.questions.map((q) => ({
              id: q.id,
              text: q.text,
              inputType: q.inputType,
              audienceType: q.audienceType,
              timerSeconds: q.timerSeconds,
              options: Array.isArray(q.options) ? q.options.map(String) : [],
              settings:
                q.settings && typeof q.settings === "object" && !Array.isArray(q.settings)
                  ? (q.settings as Record<string, number>)
                  : undefined,
              status: q.status,
              resultsVisible: q.resultsVisible,
            })),
          }}
        />

        {/* Question control table */}
        {stream.questions.length > 0 && (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Controllo domande</h2>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {stream.questions.map((q, idx) => (
                  <div key={q.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="w-5 shrink-0 text-xs font-medium text-muted">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{q.text}</p>
                      <p className="text-xs text-muted">{q.inputType} · {q.audienceType}</p>
                    </div>
                    <Badge variant={QUESTION_STATUS_VARIANTS[q.status] ?? "secondary"}>
                      {QUESTION_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                    <div className="flex shrink-0 gap-1.5">
                      {q.status !== "LIVE" && q.status !== "CLOSED" && (
                        <form action={`/api/admin/questions/${q.id}/live`} method="post">
                          <Button type="submit" size="sm">Live</Button>
                        </form>
                      )}
                      {q.status === "LIVE" && (
                        <form action={`/api/admin/questions/${q.id}/results`} method="post">
                          <Button type="submit" size="sm" variant="secondary">Risultati</Button>
                        </form>
                      )}
                      {(q.status === "LIVE" || q.status === "RESULTS") && (
                        <form action={`/api/admin/questions/${q.id}/close`} method="post">
                          <Button type="submit" size="sm" variant="ghost">Chiudi</Button>
                        </form>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
