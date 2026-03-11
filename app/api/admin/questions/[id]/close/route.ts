import { QuestionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const question = await prisma.question.update({
    where: { id },
    data: {
      status: QuestionStatus.CLOSED,
      resultsVisible: false,
    },
  });

  broadcast("question:close", {});

  return NextResponse.redirect(new URL(`/admin/streams/${question.streamId}`, process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"), 303);
}
