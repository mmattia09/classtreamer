import { QuestionStatus, StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { redirectToPath } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  return redirectToPath(`/admin/streams/${id}`);
}
