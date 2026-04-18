import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const original = await prisma.stream.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      targetClasses: true,
    },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Create a new DRAFT stream with copied settings
  const newStream = await prisma.stream.create({
    data: {
      title: `${original.title} — Copia`,
      embedUrl: original.embedUrl,
      status: "DRAFT",
      scheduledAt: null,
      // Copy target classes
      targetClasses: {
        create: original.targetClasses.map((tc) => ({ classId: tc.classId })),
      },
      // Copy questions, all reset to DRAFT
      questions: {
        create: original.questions.map((q, idx) => ({
          text: q.text,
          inputType: q.inputType,
          audienceType: q.audienceType,
          timerSeconds: q.timerSeconds,
          options: Array.isArray(q.options) ? q.options : [],
          settings: q.settings && typeof q.settings === "object" && !Array.isArray(q.settings)
            ? q.settings
            : undefined,
          order: idx,
          status: "DRAFT",
          resultsVisible: false,
        })),
      },
    },
  });

  return NextResponse.json({ id: newStream.id });
}
