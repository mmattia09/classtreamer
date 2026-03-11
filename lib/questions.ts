import { AudienceType, Prisma, QuestionInputType, QuestionStatus, StreamStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { QuestionPayload, ResultsPayload, StreamStatusResponse } from "@/lib/types";

type QuestionWithAnswers = Prisma.QuestionGetPayload<{
  include: {
    answers: true;
  };
}>;

type ClassAudienceFilter = {
  year: number;
  section: string;
};

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

export function mapQuestion(question: {
  id: string;
  text: string;
  inputType: QuestionInputType;
  audienceType: AudienceType;
  options: Prisma.JsonValue | null;
  settings: Prisma.JsonValue | null;
  timerSeconds: number | null;
  openedAt: Date | null;
  resultsVisible: boolean;
  streamId: string;
}): QuestionPayload {
  return {
    id: question.id,
    text: question.text,
    inputType: question.inputType,
    audienceType: question.audienceType,
    options: Array.isArray(question.options) ? question.options.map(String) : undefined,
    settings:
      question.settings && typeof question.settings === "object" && !Array.isArray(question.settings)
        ? (question.settings as Record<string, number>)
        : undefined,
    timerSeconds: question.timerSeconds,
    openedAt: question.openedAt?.toISOString() ?? null,
    resultsVisible: question.resultsVisible,
    streamId: question.streamId,
  };
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

  return question ? mapQuestion(question) : null;
}

export function buildResults(question: QuestionWithAnswers): ResultsPayload {
  const totalAnswers = question.answers.length;

  if (question.inputType === QuestionInputType.OPEN) {
    return {
      questionId: question.id,
      type: question.inputType,
      totalAnswers,
      entries: [],
      latestAnswers: question.answers
        .slice(-18)
        .reverse()
        .map((answer) => String((answer.value as { text?: string }).text ?? "")),
    };
  }

  if (question.inputType === QuestionInputType.WORD_COUNT) {
    const counts = new Map<string, number>();
    question.answers.forEach((answer) => {
      const raw = String((answer.value as { text?: string }).text ?? "")
        .trim()
        .toLowerCase();
      if (!raw) {
        return;
      }
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    });

    return {
      questionId: question.id,
      type: question.inputType,
      totalAnswers,
      entries: Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 20),
    };
  }

  if (question.inputType === QuestionInputType.SCALE) {
    const settings = (question.settings as Record<string, number> | null) ?? {};
    const min = Number(settings.min ?? 1);
    const max = Number(settings.max ?? 5);
    const step = Number(settings.step ?? 1);
    const counts = new Map<string, number>();

    for (let value = min; value <= max; value += step) {
      counts.set(String(value), 0);
    }

    question.answers.forEach((answer) => {
      const key = String((answer.value as { value?: number }).value ?? "");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return {
      questionId: question.id,
      type: question.inputType,
      totalAnswers,
      entries: Array.from(counts.entries()).map(([label, value]) => ({ label, value })),
    };
  }

  const counts = new Map<string, number>();
  const options = Array.isArray(question.options) ? question.options.map(String) : [];
  options.forEach((option) => counts.set(option, 0));

  question.answers.forEach((answer) => {
    if (question.inputType === QuestionInputType.MULTIPLE_CHOICE) {
      const values = Array.isArray((answer.value as { values?: string[] }).values)
        ? ((answer.value as { values?: string[] }).values as string[])
        : [];
      values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
      return;
    }

    const value = String((answer.value as { value?: string }).value ?? "");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return {
    questionId: question.id,
    type: question.inputType,
    totalAnswers,
    entries: Array.from(counts.entries()).map(([label, value]) => ({ label, value })),
  };
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
