import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    select: { status: true, timerSeconds: true },
  });

  if (!q || q.status !== "LIVE") {
    return NextResponse.json({ error: "Question not live" }, { status: 400 });
  }

  await prisma.question.update({
    where: { id },
    data: { timerSeconds: (q.timerSeconds ?? 0) + extra },
  });

  return NextResponse.json({ ok: true });
}
