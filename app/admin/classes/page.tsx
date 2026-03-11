import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
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
  const classesInput = serializeClassesInput(classes);

  return (
    <AdminShell title="Impostazioni" subtitle="Configura le classi abilitate e le opzioni di accesso.">
      <Card className="space-y-4">
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
