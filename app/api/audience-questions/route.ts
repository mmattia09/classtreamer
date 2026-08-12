import { NextResponse } from "next/server";

import {
  attachDeviceToken,
  createDeviceToken,
  isSecureRequest,
  readDeviceToken,
  shouldAttachDeviceToken,
} from "@/lib/device-token";
import { createLogger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  AUDIENCE_QUESTION_IP_WINDOW_SECONDS,
  getAudienceQuestionIpLimit,
} from "@/lib/rate-limit-config";
import { prisma } from "@/lib/prisma";
import { broadcastToAdmins } from "@/lib/socket-bridge";
import type { ViewerQuestionPayload } from "@/lib/types";
import { audienceQuestionSchema, parseJsonBody } from "@/lib/validation";

const log = createLogger("audience-questions");

/**
 * Keyed on the device, not the IP. Behind a school NAT a per-IP limit of three
 * per minute meant three questions from the entire school, not three per
 * student.
 */
const QUESTION_DEVICE_LIMIT = 3;
const QUESTION_DEVICE_WINDOW_SECONDS = 60;

// The per-IP flood guard and its window live in lib/rate-limit-config.ts.

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, audienceQuestionSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: "Testo non valido" }, { status: 400 });
  }
  const { text: normalizedText, classYear, classSection, streamId } = parsed.data;

  if (!streamId) {
    return NextResponse.json({ error: "Nessuna live attiva" }, { status: 409 });
  }

  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  });

  if (!stream || stream.status !== "LIVE") {
    return NextResponse.json({ error: "La regia non sta ricevendo domande" }, { status: 409 });
  }

  const existingToken = await readDeviceToken();
  const deviceToken = existingToken ?? createDeviceToken();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  const [deviceLimit, ipLimit] = await Promise.all([
    consumeRateLimit(
      `rate:viewer-question:device:${deviceToken}:${streamId}`,
      QUESTION_DEVICE_LIMIT,
      QUESTION_DEVICE_WINDOW_SECONDS,
    ),
    consumeRateLimit(
      `rate:viewer-question:ip:${ip}`,
      getAudienceQuestionIpLimit(),
      AUDIENCE_QUESTION_IP_WINDOW_SECONDS,
    ),
  ]);

  if (!deviceLimit.allowed || !ipLimit.allowed) {
    if (!ipLimit.allowed) {
      log.warn("Limite per IP raggiunto sulle domande dal pubblico", { ip });
    }
    return NextResponse.json(
      { error: "Troppi invii ravvicinati" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            deviceLimit.allowed ? ipLimit.retryAfter : deviceLimit.retryAfter,
          ),
        },
      },
    );
  }

  const entry = await prisma.viewerQuestion.create({
    data: {
      streamId,
      classYear: classYear ?? null,
      classSection: classSection?.toUpperCase() || null,
      text: normalizedText,
    },
  });

  const payload: ViewerQuestionPayload = {
    id: entry.id,
    streamId: entry.streamId,
    streamTitle: stream.title,
    text: entry.text,
    classYear: entry.classYear,
    classSection: entry.classSection,
    createdAt: entry.createdAt.toISOString(),
  };

  // Admins only. This carries the question text and the class it came from,
  // and it is consumed solely by the dashboard — sending it to everyone meant
  // every student's browser received every question the moment it was written,
  // before the control room had even seen it.
  broadcastToAdmins("viewer-question:new", payload);

  const response = NextResponse.json({ ok: true, question: payload });

  // Issue the device cookie here too, so a student who asks a question before
  // answering one already has a stable identity for the limit above.
  if (shouldAttachDeviceToken(existingToken)) {
    attachDeviceToken(response, deviceToken, isSecureRequest(request));
  }

  return response;
}
