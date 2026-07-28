import { QuestionStatus, StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { getResultsForQuestion, mapQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";
import { newQuestionSchema, normalizeQuestionSettings, parseJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request, newQuestionSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error, issues: parsed.issues }, { status: 400 });
  }
  const payload = parsed.data;

  const liveStream = await prisma.stream.findFirst({
    where: { status: StreamStatus.LIVE },
    orderBy: { updatedAt: "desc" },
  });

  if (!liveStream) {
    return NextResponse.json({ error: "No live stream available" }, { status: 409 });
  }

  // Closing the previous question and opening this one must be atomic: run
  // apart, two concurrent requests could leave two questions LIVE at once,
  // which getActiveQuestion() does not expect.
  const question = await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.question.aggregate({
      where: { streamId: liveStream.id },
      _max: { order: true },
    });

    await tx.question.updateMany({
      where: { status: { in: [QuestionStatus.LIVE, QuestionStatus.RESULTS] } },
      data: { status: QuestionStatus.CLOSED, resultsVisible: false },
    });

    return tx.question.create({
      data: {
        streamId: liveStream.id,
        text: payload.text,
        inputType: payload.inputType,
        audienceType: payload.audienceType,
        timerSeconds: payload.timerSeconds ?? null,
        options: payload.options ?? [],
        settings: normalizeQuestionSettings(payload.inputType, payload.settings),
        order: (existingOrder._max.order ?? 0) + 1,
        status: QuestionStatus.LIVE,
        openedAt: new Date(),
        resultsVisible: false,
      },
    });
  });

  broadcast("question:push", mapQuestion(question));
  broadcast("results:update", await getResultsForQuestion(question.id));

  return NextResponse.json({ question: mapQuestion(question) });
}
