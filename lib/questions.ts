import { QuestionStatus, StreamStatus } from "@prisma/client";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isQuestionExpiredAt } from "@/lib/question-timer";
import { buildResults, mapQuestion } from "@/lib/results";
import { broadcast } from "@/lib/socket-bridge";
import type { ResultsPayload, StreamStatusResponse } from "@/lib/types";

const log = createLogger("questions");

// Re-exported so existing imports of these helpers keep working.
export { buildResults, mapQuestion };

type ClassAudienceFilter = {
  year: number;
  section: string;
};

/** Reuses the predicate the clients use, so both sides agree on the deadline. */
function isExpiredTimer(
  question: { openedAt: Date | null; timerSeconds: number | null },
  now = Date.now(),
) {
  return isQuestionExpiredAt(
    {
      openedAt: question.openedAt?.toISOString() ?? null,
      timerSeconds: question.timerSeconds,
    },
    now,
  );
}

export async function getCurrentStreamStatus(filter?: ClassAudienceFilter): Promise<StreamStatusResponse> {
  const audienceWhere = filter
    ? {
        OR: [
          { targetClasses: { none: {} } },
          {
            targetClasses: {
              some: {
                class: {
                  year: filter.year,
                  section: filter.section,
                },
              },
            },
          },
        ],
      }
    : {};

  const live = await prisma.stream.findFirst({
    where: {
      status: StreamStatus.LIVE,
      ...audienceWhere,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (live) {
    return {
      status: "live",
      embedUrl: live.embedUrl,
      streamId: live.id,
      title: live.title,
      liveStartedAt: live.updatedAt.toISOString(),
    };
  }

  const scheduled = await prisma.stream.findFirst({
    where: {
      status: StreamStatus.SCHEDULED,
      ...audienceWhere,
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (scheduled) {
    return {
      status: "scheduled",
      embedUrl: scheduled.embedUrl,
      streamId: scheduled.id,
      title: scheduled.title,
      scheduledAt: scheduled.scheduledAt?.toISOString() ?? null,
    };
  }

  return { status: "no_stream" };
}

/**
 * The question currently on screen, or null.
 *
 * A read, and only a read. It used to close an expired question and broadcast
 * from here — but it is called by GET routes, by the class page and by the
 * dashboard, so a timer expiring with thirty classrooms connected produced
 * thirty identical writes and thirty `question:close` events for one event.
 * Expired questions are simply not returned; closing them is the job of
 * closeExpiredQuestions(), which runs in one place.
 */
export async function getActiveQuestion() {
  const question = await prisma.question.findFirst({
    where: {
      status: {
        in: [QuestionStatus.LIVE, QuestionStatus.RESULTS],
      },
      stream: {
        status: StreamStatus.LIVE,
      },
    },
    include: {
      stream: true,
    },
    orderBy: { openedAt: "desc" },
  });

  if (!question) {
    return null;
  }

  // RESULTS questions are shown deliberately by the control room and are not
  // subject to the answering timer.
  if (question.status === QuestionStatus.LIVE && isExpiredTimer(question)) {
    return null;
  }

  return mapQuestion(question);
}

/**
 * Close any question whose timer has run out.
 *
 * The `status: LIVE` clause in the update is what makes this safe to call from
 * several places at once: Postgres serialises the statements, so the first
 * caller flips the row and gets count 1, and every later caller matches nothing
 * and stays quiet. Only a caller that actually changed something broadcasts.
 */
export async function closeExpiredQuestions() {
  const candidates = await prisma.question.findMany({
    where: {
      status: QuestionStatus.LIVE,
      openedAt: { not: null },
      timerSeconds: { not: null },
    },
    select: { id: true, openedAt: true, timerSeconds: true },
  });

  const now = Date.now();
  const expiredIds = candidates
    .filter((question) => isExpiredTimer(question, now))
    .map((question) => question.id);

  if (expiredIds.length === 0) {
    return 0;
  }

  const { count } = await prisma.question.updateMany({
    where: { id: { in: expiredIds }, status: QuestionStatus.LIVE },
    data: { status: QuestionStatus.CLOSED, resultsVisible: false },
  });

  if (count > 0) {
    log.info("Domande chiuse per scadenza del timer", { count });
    broadcast("question:close", {});
  }

  return count;
}

export async function getResultsForQuestions(questionIds: string[]) {
  const results = new Map<string, ResultsPayload>();
  if (questionIds.length === 0) {
    return results;
  }

  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: {
      answers: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  for (const question of questions) {
    results.set(question.id, buildResults(question));
  }

  return results;
}

export async function getResultsForQuestion(questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      answers: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!question) {
    return null;
  }

  return buildResults(question);
}
