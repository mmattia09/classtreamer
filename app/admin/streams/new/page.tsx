import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StreamEditor } from "@/components/admin/stream-editor";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function NewStreamPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [classes, settings] = await Promise.all([
    prisma.class.findMany({
      orderBy: [{ year: "asc" }, { section: "asc" }],
    }),
    getAppSettings(),
  ]);
  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Stream</p>
        <h1 className="text-3xl font-semibold text-ink">Nuova stream</h1>
        <p className="text-ink/60">Definisci la live, le classi coinvolte e le domande.</p>
      </div>
      <StreamEditor classes={classes} />
    </AdminShell>
  );
}
