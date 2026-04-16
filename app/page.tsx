import { ClassSelection } from "@/components/class-selection";
import { buildAppConfig } from "@/lib/app-config";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [classes, settings, isAdmin] = await Promise.all([
    prisma.class.findMany({ orderBy: [{ year: "asc" }, { section: "asc" }] }),
    getAppSettings(),
    isAdminAuthenticated(),
  ]);
  const { name, icon } = buildAppConfig(settings);

  return (
    <ClassSelection
      initialClasses={classes}
      initialSettings={settings}
      appName={name}
      appIcon={icon}
      isAdmin={isAdmin}
    />
  );
}
