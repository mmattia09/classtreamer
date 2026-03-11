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

  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });
  const settings = await getAppSettings();
  const appConfig = buildAppConfig(settings);
  const classesInput = serializeClassesInput(classes);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="settings">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Impostazioni</p>
        <h1 className="text-3xl font-semibold text-ink">Configurazione applicazione</h1>
        <p className="text-ink/60">Branding, colori e classi abilitate.</p>
      </div>
      <Card className="space-y-4 shadow-none">
        <AdminSettingsForm
          initialClasses={classesInput}
          initialAppName={settings.appName}
          initialAppIcon={settings.appIcon}
          initialAppBgColor={settings.appBgColor}
          initialAppMainColor={settings.appMainColor}
          initialAppLightColor={settings.appLightColor}
        />
      </Card>
    </AdminShell>
  );
}
