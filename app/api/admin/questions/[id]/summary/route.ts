import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { getResultsForQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      stream: true,
    },
  });

  if (!question) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    question: {
      id: question.id,
      text: question.text,
      inputType: question.inputType,
      audienceType: question.audienceType,
      status: question.status,
      createdAt: question.createdAt.toISOString(),
      streamTitle: question.stream?.title ?? null,
    },
    results: await getResultsForQuestion(id),
  });
}
