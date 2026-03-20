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

  const question = await prisma.question.update({
    where: { id },
    data: {
      status: QuestionStatus.RESULTS,
      resultsVisible: true,
    },
  });

  broadcast("question:push", mapQuestion(question));
  broadcast("results:update", await getResultsForQuestion(id));

  return NextResponse.redirect(new URL(`/admin/streams/${question.streamId}`, getPublicUrl()), 303);
}
