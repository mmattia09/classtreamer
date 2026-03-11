import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/admin-overview";
import { buildAppConfig } from "@/lib/app-config";
import { getAdminOverview } from "@/lib/admin-data";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [overview, classes, settings] = await Promise.all([
    getAdminOverview(),
    prisma.class.findMany({
      orderBy: [{ year: "asc" }, { section: "asc" }],
    }),
    getAppSettings(),
  ]);
  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="dashboard">
      <AdminOverview initialOverview={overview} initialClasses={classes} />
    </AdminShell>
  );
}
