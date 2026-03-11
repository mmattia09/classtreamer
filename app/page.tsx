import { ClassSelection } from "@/components/class-selection";
import { buildAppConfig } from "@/lib/app-config";
import { prisma } from "@/lib/prisma";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });
  const settings = await getAppSettings();
  const { name, icon } = buildAppConfig(settings);

  return (
    <ClassSelection
      initialClasses={classes}
      initialSettings={settings}
      appName={name}
      appIcon={icon}
    />
  );
}
