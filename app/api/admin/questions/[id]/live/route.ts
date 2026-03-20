import { QuestionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { getResultsForQuestion, mapQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/server-config";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const target = await prisma.question.findUnique({
    where: { id },
    include: {
      stream: true,
    },
  });

  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.question.updateMany({
    where: { status: { in: [QuestionStatus.LIVE, QuestionStatus.RESULTS] } },
    data: { status: QuestionStatus.CLOSED, resultsVisible: false },
  });

  const question = await prisma.question.update({
    where: { id },
    data: {
      status: QuestionStatus.LIVE,
      resultsVisible: false,
      openedAt: new Date(),
    },
  });

  broadcast("question:push", mapQuestion(question));
  broadcast("results:update", await getResultsForQuestion(question.id));

  return NextResponse.redirect(new URL(`/admin/streams/${target.streamId}`, getPublicUrl()), 303);
}
