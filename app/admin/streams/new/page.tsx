import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StreamEditor } from "@/components/admin/stream-editor";
import { Button } from "@/components/ui/button";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewStreamPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin");

  const [classes, settings] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ year: "asc" }, { section: "asc" }] }),
    getAppSettings(),
  ]);
  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-1">
          <Link href="/admin/streams">← Tutte le stream</Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Nuova stream</h1>
        <p className="mt-0.5 text-sm text-muted">Definisci la live, le classi coinvolte e le domande preparate.</p>
      </div>
      <StreamEditor classes={classes} />
    </AdminShell>
  );
}
