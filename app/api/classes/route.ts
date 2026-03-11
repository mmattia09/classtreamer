import { NextResponse } from "next/server";

import { parseClassesInput } from "@/lib/classes";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function GET() {
  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  const payload =
    contentType.includes("application/json")
      ? ((await request.json()) as { year?: number; section?: string; displayName?: string; classes?: string })
      : Object.fromEntries(await request.formData());

  if (payload.classes) {
    const entries = parseClassesInput(String(payload.classes));

    await prisma.$transaction([
      prisma.class.deleteMany(),
      prisma.class.createMany({
        data: entries.map((entry) => ({
          year: entry.year,
          section: entry.section,
          displayName: entry.displayName ?? null,
        })),
      }),
    ]);
  } else if (payload.year && payload.section) {
    await prisma.class.create({
      data: {
        year: Number(payload.year),
        section: String(payload.section).toUpperCase(),
        displayName: payload.displayName ? String(payload.displayName) : undefined,
      },
    });
  }

  const classes = await prisma.class.findMany({
    orderBy: [{ year: "asc" }, { section: "asc" }],
  });

  broadcast("classes:update", classes);

  return NextResponse.json({ ok: true, classes });
}
