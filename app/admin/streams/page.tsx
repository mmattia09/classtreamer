import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StreamsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const streams = await prisma.stream.findMany({
    include: {
      questions: true,
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
  });

  return (
    <AdminShell title="Stream" subtitle="Archivio completo e controllo dello stato di pubblicazione.">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/streams/new">Nuova stream</Link>
        </Button>
      </div>
      <div className="grid gap-4">
        {streams.map((stream) => (
          <Card key={stream.id} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">{stream.title}</h2>
              <p className="text-ink/70">{formatDateTime(stream.scheduledAt)}</p>
              <p className="mt-2 text-sm text-ink/60">{stream.embedUrl}</p>
              <p className="mt-2 text-sm font-medium text-ocean">
                {stream.questions.length} domande preparate
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <span className="rounded-full bg-ocean/10 px-3 py-2 text-sm font-medium text-ocean">
                {stream.status}
              </span>
              <Button asChild variant="secondary">
                <Link href={`/admin/streams/${stream.id}`}>Modifica</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
