import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (!await isAdminAuthenticated()) {
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
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = (await request.json()) as {
    title: string;
    embedUrl: string;
    scheduledAt?: string;
    targetClassIds: string[];
    questions: Array<{
      text: string;
      inputType: string;
      audienceType: string;
      timerSeconds?: number;
      options?: string[];
      settings?: Record<string, number>;
    }>;
  };

  const stream = await prisma.stream.create({
    data: {
      title: payload.title,
      embedUrl: payload.embedUrl,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      status: payload.scheduledAt ? StreamStatus.SCHEDULED : StreamStatus.DRAFT,
      targetClasses: {
        create: payload.targetClassIds.map((classId) => ({ classId })),
      },
      questions: {
        create: payload.questions.map((question, index) => ({
          text: question.text,
          inputType: question.inputType as never,
          audienceType: question.audienceType as never,
          timerSeconds: question.timerSeconds ?? null,
          options: question.options ?? [],
          settings:
            question.inputType === "SCALE"
              ? {
                  min: question.settings?.min ?? 1,
                  max: question.settings?.max ?? 5,
                  step: question.settings?.step ?? 1,
                }
              : question.inputType === "WORD_COUNT"
                ? {
                    maxWords: question.settings?.maxWords ?? 3,
                  }
                : undefined,
          order: index,
        })),
      },
    },
  });

  return NextResponse.json({ id: stream.id });
}
