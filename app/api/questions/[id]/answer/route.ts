import { QuestionStatus } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getResultsForQuestion } from "@/lib/questions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { broadcast } from "@/lib/socket-bridge";
import { answerSchema, parseJsonBody } from "@/lib/validation";

// Answers arrive from a whole class at once; this bounds one device to a
// sensible burst without blocking a legitimate re-submit.
const ANSWER_RATE_LIMIT = 10;
const ANSWER_RATE_WINDOW_SECONDS = 10;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // classYear/classSection used to go into Prisma unchecked, so a non-integer
  // year surfaced as a 500 from the driver.
  const parsed = await parseJsonBody(request, answerSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { classYear, classSection, value } = parsed.data;

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const allowed = await checkRateLimit(
    `rate:answer:${ip}:${id}`,
    ANSWER_RATE_LIMIT,
    ANSWER_RATE_WINDOW_SECONDS,
  );

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

  const options = Array.isArray(question.options) ? question.options.map(String) : [];
  const settings = (question.settings as Record<string, number> | null) ?? {};

  // Only the fields belonging to the question type are persisted. Storing the
  // request body as-is let a client attach arbitrary extra keys to the row.
  let storedValue: object;

  if (question.inputType === "WORD_COUNT") {
    const text = String((value as { text?: string })?.text ?? "").trim();
    const words = text.split(/\s+/).filter(Boolean);
    const maxWords = Number(settings.maxWords ?? 3);

    if (!words.length || words.length > maxWords || text.length > 200) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
    storedValue = { text };
  } else if (question.inputType === "OPEN") {
    const text = String((value as { text?: string })?.text ?? "").trim();
    if (!text || text.length > 2000) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
    storedValue = { text };
  } else if (question.inputType === "SCALE") {
    const min = Number(settings.min ?? 1);
    const max = Number(settings.max ?? 5);
    const numericValue = Number((value as { value?: number })?.value);

    if (!Number.isFinite(numericValue) || numericValue < min || numericValue > max) {
      return NextResponse.json({ error: "Valore scala non valido" }, { status: 400 });
    }
    storedValue = { value: numericValue };
  } else if (question.inputType === "SINGLE_CHOICE") {
    const selectedValue = String((value as { value?: string })?.value ?? "");
    if (!selectedValue || !options.includes(selectedValue)) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
    storedValue = { value: selectedValue };
  } else {
    const selectedValues = Array.isArray((value as { values?: string[] })?.values)
      ? ((value as { values?: string[] }).values as string[])
      : [];
    if (!selectedValues.length || selectedValues.some((entry) => !options.includes(entry))) {
      return NextResponse.json({ error: "Risposta non valida" }, { status: 400 });
    }
    // Deduplicate: the same option counted twice would skew the tally.
    storedValue = { values: Array.from(new Set(selectedValues)) };
  }

  await prisma.answer.create({
    data: {
      questionId: id,
      classYear: classYear ?? null,
      classSection: classSection ?? null,
      value: storedValue,
    },
  });

  const results = await getResultsForQuestion(id);
  if (results) {
    broadcast("results:update", results);
  }

  return NextResponse.json({ ok: true });
}
