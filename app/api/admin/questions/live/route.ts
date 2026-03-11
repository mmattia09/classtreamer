import { QuestionStatus, StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getResultsForQuestion, mapQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    text: string;
    inputType: string;
    audienceType: string;
    timerSeconds?: number;
    options?: string[];
  };

  const liveStream = await prisma.stream.findFirst({
    where: { status: StreamStatus.LIVE },
    orderBy: { updatedAt: "desc" },
  });

  if (!liveStream) {
    return NextResponse.json({ error: "No live stream available" }, { status: 409 });
  }

  const existingOrder = await prisma.question.aggregate({
    where: { streamId: liveStream.id },
    _max: { order: true },
  });

  await prisma.question.updateMany({
    where: { status: { in: [QuestionStatus.LIVE, QuestionStatus.RESULTS] } },
    data: { status: QuestionStatus.CLOSED, resultsVisible: false },
  });

  const question = await prisma.question.create({
    data: {
      streamId: liveStream.id,
      text: payload.text,
      inputType: payload.inputType as never,
      audienceType: payload.audienceType as never,
      timerSeconds: payload.timerSeconds ?? null,
      options: payload.options ?? [],
      order: (existingOrder._max.order ?? 0) + 1,
      status: QuestionStatus.LIVE,
      openedAt: new Date(),
      resultsVisible: false,
    },
  });

  broadcast("question:push", mapQuestion(question));
  broadcast("results:update", await getResultsForQuestion(question.id));

  return NextResponse.json({ question: mapQuestion(question) });
}
