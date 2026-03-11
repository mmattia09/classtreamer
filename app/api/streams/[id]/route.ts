import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const stream = await prisma.stream.findUnique({
    where: { id },
    include: {
      questions: true,
      targetClasses: true,
    },
  });

  return NextResponse.json(stream);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = (await request.json()) as {
    title: string;
    embedUrl: string;
    scheduledAt?: string;
    targetClassIds: string[];
    questions: Array<{
      id: string;
      text: string;
      inputType: string;
      audienceType: string;
      timerSeconds?: number;
      options?: string[];
      settings?: Record<string, number>;
    }>;
  };

  await prisma.stream.update({
    where: { id },
    data: {
      title: payload.title,
      embedUrl: payload.embedUrl,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
      targetClasses: {
        deleteMany: {},
        create: payload.targetClassIds.map((classId) => ({ classId })),
      },
      questions: {
        deleteMany: {},
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
              : undefined,
          order: index,
        })),
      },
    },
  });

  return NextResponse.json({ id });
}
