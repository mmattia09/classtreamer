import { Prisma, QuestionStatus } from "@prisma/client";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  attachDeviceToken,
  createDeviceToken,
  isSecureRequest,
  readDeviceToken,
  shouldAttachDeviceToken,
} from "@/lib/device-token";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { ANSWER_IP_WINDOW_SECONDS, getAnswerIpLimit } from "@/lib/rate-limit-config";
import { publishResultsThrottled } from "@/lib/results-broadcast";
import { answerSchema, parseJsonBody } from "@/lib/validation";

const log = createLogger("answer");

/**
 * Rate limiting is keyed on the device, not on the IP address.
 *
 * A school NATs every student phone behind one public address, so a per-IP
 * limit counts a whole class as a single client: 25 students answering at once
 * would see most of their submissions rejected. Duplicate answers are already
 * prevented by the unique index on (questionId, deviceToken), so this only has
 * to stop one device from hammering.
 */
const ANSWER_DEVICE_LIMIT = 5;
const ANSWER_DEVICE_WINDOW_SECONDS = 10;

// The per-IP flood guard and its window live in lib/rate-limit-config.ts,
// where they can be tuned for the size of the school.

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

  // Read before rate limiting so the device key is available for it.
  const existingToken = await readDeviceToken();
  const deviceToken = existingToken ?? createDeviceToken();

  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const [deviceAllowed, ipAllowed] = await Promise.all([
    checkRateLimit(
      `rate:answer:device:${deviceToken}:${id}`,
      ANSWER_DEVICE_LIMIT,
      ANSWER_DEVICE_WINDOW_SECONDS,
    ),
    checkRateLimit(`rate:answer:ip:${ip}`, getAnswerIpLimit(), ANSWER_IP_WINDOW_SECONDS),
  ]);

  if (!deviceAllowed || !ipAllowed) {
    if (!ipAllowed) {
      log.warn("Limite per IP raggiunto sulle risposte", { ip });
    }
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

  // One answer per device per question, enforced by a unique index rather than
  // a read-then-write, so two simultaneous submissions cannot both slip past.
  try {
    await prisma.answer.create({
      data: {
        questionId: id,
        classYear: classYear ?? null,
        classSection: classSection ?? null,
        value: storedValue,
        deviceToken,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Hai gia' risposto a questa domanda" }, { status: 409 });
    }
    log.error("Salvataggio della risposta non riuscito", error, { questionId: id });
    throw error;
  }

  // Coalesced: a class answering at once produces one recompute per window
  // rather than one per submission.
  await publishResultsThrottled(id);

  const response = NextResponse.json({ ok: true });

  if (shouldAttachDeviceToken(existingToken)) {
    attachDeviceToken(response, deviceToken, isSecureRequest(request));
  }

  return response;
}
