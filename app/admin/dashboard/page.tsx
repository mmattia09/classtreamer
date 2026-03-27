import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOverview } from "@/components/admin/admin-overview";
import { DashboardClassesSidebar } from "@/components/admin/dashboard-classes-sidebar";
import { buildAppConfig } from "@/lib/app-config";
import { getAdminOverview } from "@/lib/admin-data";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const DEFAULT_SIDEBAR_WIDTH = 320;
const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 440;

function parseSidebarWidth(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SIDEBAR_WIDTH;
  }

  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, parsed));
}

export default async function DashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const cookieStore = await cookies();
  const initialSidebarWidth = parseSidebarWidth(cookieStore.get("admin_sidebar_width")?.value);
  const initialSidebarCollapsed = cookieStore.get("admin_sidebar_collapsed")?.value === "1";

  const [overview, classes, settings] = await Promise.all([
    getAdminOverview(),
    prisma.class.findMany({
      orderBy: [{ year: "asc" }, { section: "asc" }],
    }),
    getAppSettings(),
  ]);
  const appConfig = buildAppConfig(settings);

  return (
    <AdminShell
      appName={appConfig.name}
      appIcon={appConfig.icon}
      active="dashboard"
      sidebar={<DashboardClassesSidebar initialClasses={classes} initialViewerQuestions={overview.viewerQuestions} />}
      initialSidebarWidth={initialSidebarWidth}
      initialSidebarCollapsed={initialSidebarCollapsed}
    >
      <div className="space-y-6">
        <AdminOverview initialOverview={overview} />
        <div className="xl:hidden">
          <DashboardClassesSidebar initialClasses={classes} initialViewerQuestions={overview.viewerQuestions} mobile />
        </div>
      </div>
    </AdminShell>
  );
}
