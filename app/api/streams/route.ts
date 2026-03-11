import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
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
          order: index,
        })),
      },
    },
  });

  return NextResponse.json({ id: stream.id });
}
