import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { StreamEditor } from "@/components/admin/stream-editor";
import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NewStreamPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });

  return (
    <AdminShell title="Nuova stream" subtitle="Crea una diretta, associa classi e prepara le domande.">
      <StreamEditor classes={classes} />
    </AdminShell>
  );
}
