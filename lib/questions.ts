import { QuestionStatus, StreamStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildResults, mapQuestion } from "@/lib/results";
import { broadcast } from "@/lib/socket-bridge";
import type { ResultsPayload, StreamStatusResponse } from "@/lib/types";

// Re-exported so existing imports of these helpers keep working.
export { buildResults, mapQuestion };

type ClassAudienceFilter = {
  year: number;
  section: string;
};

function isExpiredTimer(question: { status: QuestionStatus; openedAt: Date | null; timerSeconds: number | null }) {
  if (question.status !== QuestionStatus.LIVE || !question.openedAt || !question.timerSeconds) {
    return false;
  }

  return question.openedAt.getTime() + question.timerSeconds * 1000 <= Date.now();
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

  if (question && isExpiredTimer(question)) {
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: QuestionStatus.CLOSED,
        resultsVisible: false,
      },
    });
    // Notify all clients that the question has been closed due to timer expiry
    broadcast("question:close", { questionId: question.id });
    return null;
  }

  return question ? mapQuestion(question) : null;
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
