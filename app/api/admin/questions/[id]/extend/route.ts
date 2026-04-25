import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { mapQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { seconds?: number };
  const extra = Math.min(Math.max(Number(body.seconds ?? 30), 5), 300);

  const q = await prisma.question.findUnique({
    where: { id },
    select: {
      id: true,
      text: true,
      inputType: true,
      audienceType: true,
      options: true,
      settings: true,
      timerSeconds: true,
      openedAt: true,
      resultsVisible: true,
      streamId: true,
      status: true,
    },
  });

  if (!q || q.status !== "LIVE") {
    return NextResponse.json({ error: "Question not live" }, { status: 400 });
  }

  const question = await prisma.question.update({
    where: { id },
    data: {
      timerSeconds: q.timerSeconds === null ? null : q.timerSeconds + extra,
    },
    select: {
      id: true,
      text: true,
      inputType: true,
      audienceType: true,
      options: true,
      settings: true,
      timerSeconds: true,
      openedAt: true,
      resultsVisible: true,
      streamId: true,
    },
  });

  const payload = mapQuestion(question);
  broadcast("question:update", payload);

  return NextResponse.json({ ok: true, question: payload });
}
