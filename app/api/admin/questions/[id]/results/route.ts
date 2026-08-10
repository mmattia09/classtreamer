import { QuestionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { mapQuestion } from "@/lib/questions";
import { redirectToPath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { publishResultsNow } from "@/lib/results-broadcast";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const question = await prisma.question.update({
    where: { id },
    data: {
      status: QuestionStatus.RESULTS,
      resultsVisible: true,
    },
  });

  broadcast("question:push", mapQuestion(question));
  await publishResultsNow(id);

  return redirectToPath(`/admin/streams/${question.streamId}`);
}
