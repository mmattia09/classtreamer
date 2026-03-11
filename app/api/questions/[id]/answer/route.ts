import { QuestionStatus } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getResultsForQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { classYear, classSection, value } = (await request.json()) as {
    classYear?: number;
    classSection?: string;
    value: unknown;
  };

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const allowed = await checkRateLimit(`rate:answer:${ip}:${id}`);

  if (!allowed) {
    return NextResponse.json({ error: "Troppi invii ravvicinati" }, { status: 429 });
  }

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      stream: true,
    },
  });

  if (
    !question ||
    (question.status !== QuestionStatus.LIVE && question.status !== QuestionStatus.RESULTS)
  ) {
    return NextResponse.json({ error: "Domanda non disponibile" }, { status: 404 });
  }

  await prisma.answer.create({
    data: {
      questionId: id,
      classYear,
      classSection,
      value: value as object,
    },
  });

  const results = await getResultsForQuestion(id);
  if (results) {
    broadcast("results:update", results);
  }

  return NextResponse.json({ ok: true });
}
