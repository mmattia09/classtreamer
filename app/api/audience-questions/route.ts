import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";
import type { ViewerQuestionPayload } from "@/lib/types";

export async function POST(request: Request) {
  const { text, classYear, classSection, streamId } = (await request.json()) as {
    text?: string;
    classYear?: number;
    classSection?: string;
    streamId?: string;
  };

  const normalizedText = text?.trim() ?? "";
  if (normalizedText.length < 4 || normalizedText.length > 280) {
    return NextResponse.json({ error: "Testo non valido" }, { status: 400 });
  }

  if (!streamId) {
    return NextResponse.json({ error: "Nessuna live attiva" }, { status: 409 });
  }

  const stream = await prisma.stream.findUnique({
    where: { id: streamId },
  });

  if (!stream || stream.status !== "LIVE") {
    return NextResponse.json({ error: "La regia non sta ricevendo domande" }, { status: 409 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rateLimit = await consumeRateLimit(`rate:viewer-question:${ip}:${streamId}`, 3, 60);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Troppi invii ravvicinati" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter),
        },
      },
    );
  }

  const entry = await prisma.viewerQuestion.create({
    data: {
      streamId,
      classYear: Number.isInteger(classYear) ? classYear : null,
      classSection: classSection?.trim().toUpperCase() || null,
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

  broadcast("viewer-question:new", payload);
  return NextResponse.json({ ok: true, question: payload });
}
