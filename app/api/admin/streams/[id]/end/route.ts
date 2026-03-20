import { QuestionStatus, StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/server-config";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.stream.update({
    where: { id },
    data: { status: StreamStatus.ENDED },
  });
  await prisma.question.updateMany({
    where: { streamId: id, status: { in: [QuestionStatus.LIVE, QuestionStatus.RESULTS] } },
    data: { status: QuestionStatus.CLOSED, resultsVisible: false },
  });

  broadcast("stream:status", { status: "no_stream" });
  broadcast("question:close", {});

  return NextResponse.redirect(new URL(`/admin/streams/${id}`, getPublicUrl()), 303);
}
