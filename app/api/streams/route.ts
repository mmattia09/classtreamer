import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStreamSchema, normalizeQuestionSettings, parseJsonBody } from "@/lib/validation";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const streams = await prisma.stream.findMany({
    include: {
      questions: true,
      targetClasses: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(streams);
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, createStreamSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const payload = parsed.data;
  const scheduledAt = payload.scheduledAt ? new Date(payload.scheduledAt) : null;

  const stream = await prisma.stream.create({
    data: {
      title: payload.title,
      embedUrl: payload.embedUrl,
      scheduledAt,
      status: scheduledAt ? StreamStatus.SCHEDULED : StreamStatus.DRAFT,
      targetClasses: {
        create: payload.targetClassIds.map((classId) => ({ classId })),
      },
      questions: {
        create: payload.questions.map((question, index) => ({
          text: question.text,
          inputType: question.inputType,
          audienceType: question.audienceType,
          timerSeconds: question.timerSeconds ?? null,
          options: question.options ?? [],
          settings: normalizeQuestionSettings(question.inputType, question.settings),
          order: index,
        })),
      },
    },
  });

  return NextResponse.json({ id: stream.id });
}
