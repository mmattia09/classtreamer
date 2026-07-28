import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { parseClassesInput } from "@/lib/classes";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";
import { classesInputSchema } from "@/lib/validation";

export async function GET() {
  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const raw = contentType.includes("application/json")
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData());

  const parsed = classesInputSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi" },
      { status: 400 },
    );
  }
  const payload = parsed.data;

  if (payload.classes !== undefined) {
    const entries = parseClassesInput(payload.classes);

    // Reconcile instead of delete-all-then-recreate. StreamClass cascades on
    // class deletion, so wiping the table dropped every stream's target
    // classes — and a stream with no targets is visible to every class.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.class.findMany({
        select: { id: true, year: true, section: true },
      });

      const keyOf = (entry: { year: number; section: string }) => `${entry.year}-${entry.section}`;
      const incoming = new Set(entries.map(keyOf));

      const removableIds = existing
        .filter((entry) => !incoming.has(keyOf(entry)))
        .map((entry) => entry.id);

      if (removableIds.length > 0) {
        await tx.class.deleteMany({ where: { id: { in: removableIds } } });
      }

      // Untouched rows keep their id, so stream associations survive.
      await tx.class.createMany({
        data: entries.map((entry) => ({
          year: entry.year,
          section: entry.section,
          displayName: entry.displayName ?? null,
        })),
        skipDuplicates: true,
      });
    });
  } else if (payload.year !== undefined && payload.section) {
    // `year` is compared against undefined rather than truthiness: year 0 is
    // the marker for non-numbered classes (INSEGNANTI and similar).
    await prisma.class.upsert({
      where: { year_section: { year: payload.year, section: payload.section.toUpperCase() } },
      update: { displayName: payload.displayName || null },
      create: {
        year: payload.year,
        section: payload.section.toUpperCase(),
        displayName: payload.displayName || null,
      },
    });
  }

  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });

  broadcast("classes:update", classes);

  return NextResponse.json({ ok: true, classes });
}
