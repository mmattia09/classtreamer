import { AudienceType, Prisma, QuestionInputType, QuestionStatus, StreamStatus } from "@prisma/client";

import { getYearLabel } from "@/lib/classes";
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

function tokenizeWordCloudValue(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9àèéìòùáíóúäëïöüç]+/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getQuestionScaleSettings(question: { settings: Prisma.JsonValue | null }) {
  const settings = (question.settings as Record<string, number> | null) ?? {};
  return {
    min: Number(settings.min ?? 1),
    max: Number(settings.max ?? 5),
    step: Number(settings.step ?? 1),
  };
}

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

  if (question && isExpiredTimer(question)) {
    await prisma.question.update({
      where: { id: question.id },
      data: {
        status: QuestionStatus.CLOSED,
        resultsVisible: false,
      },
    });
    return null;
  }

  return question ? mapQuestion(question) : null;
}

export function buildResults(question: QuestionWithAnswers, answerIds?: string[]): ResultsPayload {
  const filteredAnswers = answerIds?.length
    ? question.answers.filter((answer) => answerIds.includes(answer.id))
    : question.answers;
  const totalAnswers = filteredAnswers.length;
  const latestSubmissions = filteredAnswers
    .slice(-18)
    .reverse()
    .map((answer) => {
      const classLabel =
        answer.classYear === null || answer.classYear === undefined || !answer.classSection
          ? null
          : `${getYearLabel(answer.classYear)}${answer.classSection}`;

      if (question.inputType === QuestionInputType.OPEN || question.inputType === QuestionInputType.WORD_COUNT) {
        return {
          id: answer.id,
          value: String((answer.value as { text?: string }).text ?? ""),
          classLabel,
          createdAt: answer.createdAt.toISOString(),
        };
      }

      if (question.inputType === QuestionInputType.SCALE) {
        return {
          id: answer.id,
          value: String((answer.value as { value?: number }).value ?? ""),
          classLabel,
          createdAt: answer.createdAt.toISOString(),
        };
      }

      if (question.inputType === QuestionInputType.MULTIPLE_CHOICE) {
        const values = Array.isArray((answer.value as { values?: string[] }).values)
          ? ((answer.value as { values?: string[] }).values as string[])
          : [];
        return {
          id: answer.id,
          value: values.join(", "),
          classLabel,
          createdAt: answer.createdAt.toISOString(),
        };
      }

      return {
        id: answer.id,
        value: String((answer.value as { value?: string }).value ?? ""),
        classLabel,
        createdAt: answer.createdAt.toISOString(),
      };
    });

  if (question.inputType === QuestionInputType.OPEN) {
    return {
      questionId: question.id,
      type: question.inputType,
      questionText: question.text,
      totalAnswers,
      entries: [],
      latestAnswers: filteredAnswers
        .slice(-18)
        .reverse()
        .map((answer) => String((answer.value as { text?: string }).text ?? "")),
      latestSubmissions,
    };
  }

  if (question.inputType === QuestionInputType.WORD_COUNT) {
    const counts = new Map<string, number>();
    filteredAnswers.forEach((answer) => {
      const raw = String((answer.value as { text?: string }).text ?? "");
      tokenizeWordCloudValue(raw).forEach((word) => {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      });
    });

    return {
      questionId: question.id,
      type: question.inputType,
      questionText: question.text,
      totalAnswers,
      entries: Array.from(counts.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 36),
      latestSubmissions,
    };
  }

  if (question.inputType === QuestionInputType.SCALE) {
    const { min, max, step } = getQuestionScaleSettings(question);
    const counts = new Map<string, number>();
    let sum = 0;

    for (let value = min; value <= max; value += step) {
      counts.set(String(value), 0);
    }

    filteredAnswers.forEach((answer) => {
      const numericValue = Number((answer.value as { value?: number }).value ?? NaN);
      if (!Number.isFinite(numericValue)) {
        return;
      }
      const key = String(numericValue);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      sum += numericValue;
    });

    return {
      questionId: question.id,
      type: question.inputType,
      questionText: question.text,
      totalAnswers,
      entries: Array.from(counts.entries()).map(([label, value]) => ({
        label,
        value,
        percentage: totalAnswers ? Math.round((value / totalAnswers) * 100) : 0,
      })),
      latestSubmissions,
      average: totalAnswers ? Number((sum / totalAnswers).toFixed(1)) : null,
      scale: { min, max, step },
    };
  }

  const counts = new Map<string, number>();
  const options = Array.isArray(question.options) ? question.options.map(String) : [];
  options.forEach((option) => counts.set(option, 0));

  filteredAnswers.forEach((answer) => {
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
    questionText: question.text,
    totalAnswers,
    entries: Array.from(counts.entries()).map(([label, value]) => ({
      label,
      value,
      percentage: totalAnswers ? Math.round((value / totalAnswers) * 100) : 0,
    })),
    latestSubmissions,
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
