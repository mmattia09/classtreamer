import { notFound, redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StreamEditor } from "@/components/admin/stream-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StreamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const { id } = await params;
  const [classes, stream, settings] = await Promise.all([
    prisma.class.findMany({
      orderBy: [{ year: "asc" }, { section: "asc" }],
    }),
    prisma.stream.findUnique({
      where: { id },
      include: {
        targetClasses: true,
        questions: {
          orderBy: { order: "asc" },
        },
      },
    }),
    getAppSettings(),
  ]);

  if (!stream) {
    notFound();
  }

  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Stream</p>
        <h1 className="text-3xl font-semibold text-ink">{stream.title}</h1>
        <p className="text-ink/60">Modifica la live e gestisci le domande preparate.</p>
      </div>

      <div className="space-y-6">
        <Card className="flex flex-wrap gap-3 shadow-none">
          <form action={`/api/admin/streams/${stream.id}/live`} method="post">
            <Button type="submit">Vai live</Button>
          </form>
          <form action={`/api/admin/streams/${stream.id}/end`} method="post">
            <Button type="submit" variant="danger">
              Termina stream
            </Button>
          </form>
        </Card>

        <StreamEditor
          classes={classes}
          stream={{
            id: stream.id,
            title: stream.title,
            embedUrl: stream.embedUrl,
            scheduledAt: stream.scheduledAt ? stream.scheduledAt.toISOString().slice(0, 16) : "",
            status: stream.status,
            targetClassIds: stream.targetClasses.map((entry) => entry.classId),
            questions: stream.questions.map((question) => ({
              id: question.id,
              text: question.text,
              inputType: question.inputType,
              audienceType: question.audienceType,
              timerSeconds: question.timerSeconds,
              options: Array.isArray(question.options) ? question.options.map(String) : [],
              settings:
                question.settings && typeof question.settings === "object" && !Array.isArray(question.settings)
                  ? (question.settings as Record<string, number>)
                  : undefined,
              status: question.status,
              resultsVisible: question.resultsVisible,
            })),
          }}
        />

        <Card className="space-y-4 shadow-none">
          <h2 className="text-2xl font-semibold">Controllo domande</h2>
          <div className="space-y-3">
            {stream.questions.map((question) => (
              <div key={question.id} className="flex flex-col gap-3 rounded-3xl border border-ocean/10 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-semibold">{question.text}</p>
                  <p className="text-sm text-ink/65">
                    {question.inputType} · {question.audienceType} · {question.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <form action={`/api/admin/questions/${question.id}/live`} method="post">
                    <Button type="submit">Go Live</Button>
                  </form>
                  <form action={`/api/admin/questions/${question.id}/results`} method="post">
                    <Button type="submit" variant="secondary">
                      Mostra risultati
                    </Button>
                  </form>
                  <form action={`/api/admin/questions/${question.id}/close`} method="post">
                    <Button type="submit" variant="ghost">
                      Chiudi
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
