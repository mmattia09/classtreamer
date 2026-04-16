import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { serializeClassesInput } from "@/lib/classes";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [classes, settings] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ year: "asc" }, { section: "asc" }] }),
    getAppSettings(),
  ]);
  const appConfig = buildAppConfig(settings);
  const classesInput = serializeClassesInput(classes);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="settings">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Impostazioni</h1>
        <p className="mt-0.5 text-sm text-muted">Branding e classi abilitate.</p>
      </div>
      <Card className="overflow-hidden p-0">
        <AdminSettingsForm
          initialClasses={classesInput}
          initialAppName={settings.appName}
          initialAppIcon={settings.appIcon}
        />
      </Card>
    </AdminShell>
  );
}
