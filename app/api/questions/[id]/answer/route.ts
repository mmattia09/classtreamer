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

  if (question.openedAt && question.timerSeconds) {
    const expiresAt = question.openedAt.getTime() + question.timerSeconds * 1000;
    if (expiresAt <= Date.now()) {
      return NextResponse.json({ error: "Tempo scaduto" }, { status: 410 });
    }
  }

  if (question.inputType === "WORD_COUNT") {
    const text = String((value as { text?: string })?.text ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const maxWords = Number((question.settings as Record<string, number> | null)?.maxWords ?? 3);

    if (!text.length || text.length > maxWords) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
  }

  if (question.inputType === "OPEN") {
    const text = String((value as { text?: string })?.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
  }

  if (question.inputType === "SCALE") {
    const settings = (question.settings as Record<string, number> | null) ?? {};
    const min = Number(settings.min ?? 1);
    const max = Number(settings.max ?? 5);
    const numericValue = Number((value as { value?: number })?.value);

    if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
      return NextResponse.json({ error: "Valore scala non valido" }, { status: 400 });
    }
  }

  if (question.inputType === "SINGLE_CHOICE") {
    const selectedValue = String((value as { value?: string })?.value ?? "");
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    if (!selectedValue || !options.includes(selectedValue)) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
  }

  if (question.inputType === "MULTIPLE_CHOICE") {
    const selectedValues = Array.isArray((value as { values?: string[] })?.values)
      ? ((value as { values?: string[] }).values as string[])
      : [];
    const options = Array.isArray(question.options) ? question.options.map(String) : [];
    if (!selectedValues.length || selectedValues.some((entry) => !options.includes(entry))) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
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
