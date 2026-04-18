import { QuestionStatus, StreamStatus } from "@prisma/client";
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

  const current = await prisma.stream.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canUpdateStatus = current?.status === StreamStatus.DRAFT || current?.status === StreamStatus.SCHEDULED;
  const newStatus = canUpdateStatus
    ? payload.scheduledAt ? StreamStatus.SCHEDULED : StreamStatus.DRAFT
    : undefined;
  const existingQuestionsById = new Map(current.questions.map((question) => [question.id, question]));
  const incomingQuestionIds = new Set(
    payload.questions
      .map((question) => question.id)
      .filter((questionId) => existingQuestionsById.has(questionId)),
  );

  const deletableQuestionIds = current.questions
    .filter((question) => !incomingQuestionIds.has(question.id) && question.status === QuestionStatus.DRAFT)
    .map((question) => question.id);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.stream.update({
      where: { id },
      data: {
        title: payload.title,
        embedUrl: payload.embedUrl,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : null,
        ...(newStatus !== undefined && { status: newStatus }),
        targetClasses: {
          deleteMany: {},
          create: payload.targetClassIds.map((classId) => ({ classId })),
        },
      },
    });

    if (deletableQuestionIds.length > 0) {
      await tx.question.deleteMany({
        where: {
          id: { in: deletableQuestionIds },
        },
      });
    }

    for (const [index, question] of payload.questions.entries()) {
      const questionData = {
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
      };

      if (existingQuestionsById.has(question.id)) {
        await tx.question.update({
          where: { id: question.id },
          data: questionData,
        });
        continue;
      }

      await tx.question.create({
        data: {
          ...questionData,
          streamId: id,
        },
      });
    }

    return tx.stream.findUnique({
      where: { id },
      include: {
        targetClasses: true,
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    stream: {
      id: updated.id,
      title: updated.title,
      embedUrl: updated.embedUrl,
      scheduledAt: updated.scheduledAt?.toISOString() ?? "",
      status: updated.status,
      targetClassIds: updated.targetClasses.map((entry) => entry.classId),
      questions: updated.questions.map((question) => ({
        id: question.id,
        text: question.text,
        inputType: question.inputType,
        audienceType: question.audienceType,
        timerSeconds: question.timerSeconds,
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        settings:
          question.settings && typeof question.settings === "object" && !Array.isArray(question.settings)
            ? (question.settings as Record<string, number>)
            : undefined,
        status: question.status,
        resultsVisible: question.resultsVisible,
      })),
    },
  });
}
