import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/admin-overview";
import { buildAppConfig } from "@/lib/app-config";
import { getAdminOverview } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function StreamsPage() {
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
    <AdminShell appName={appConfig.name} appIcon={appConfig.icon} active="streams">
      <AdminOverview initialOverview={overview} initialClasses={classes} focusSection="streams" />
    </AdminShell>
  );
}
