import type { Prisma } from "@prisma/client";
import { AudienceType, QuestionInputType } from "@prisma/client";

import { getYearLabel } from "@/lib/classes";
import type { QuestionPayload, ResultsPayload } from "@/lib/types";

// Pure shaping of question rows into the payloads the clients render. Kept
// apart from lib/questions.ts, which reaches for the database and therefore
// pulls in "server-only" — that makes this logic impossible to unit test and
// mixes computation with data access for no reason.

type QuestionWithAnswers = Prisma.QuestionGetPayload<{
  include: {
    answers: true;
  };
}>;

function tokenizeWordCloudValue(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9àèéìòùáíóúäëïöüç]+/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getQuestionScaleSettings(question: { settings: Prisma.JsonValue | null }) {
  const settings = (question.settings as Record<string, number> | null) ?? {};
  const min = Number(settings.min ?? 1);
  const max = Number(settings.max ?? 5);
  const step = Number(settings.step ?? 1);

  // buildResults() walks `for (v = min; v <= max; v += step)`. A non-positive
  // step or a non-finite bound would spin forever and hang the request, so the
  // values read back from the database are clamped even though writes are now
  // validated — rows created before that validation may still be malformed.
  const safeMin = Number.isFinite(min) ? min : 1;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : safeMin + 1;
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;

  return {
    min: safeMin,
    max: safeMax,
    // Cap the number of buckets so a huge range cannot build a giant map.
    step: (safeMax - safeMin) / safeStep > 1000 ? (safeMax - safeMin) / 1000 : safeStep,
  };
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

export function buildResults(question: QuestionWithAnswers, answerIds?: string[]): ResultsPayload {
  const filteredAnswers = answerIds?.length
    ? question.answers.filter((answer) => answerIds.includes(answer.id))
    : question.answers;
  const totalAnswers = filteredAnswers.length;
  const latestSubmissions = [...filteredAnswers]
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
      latestAnswers: [...filteredAnswers]
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

/**
 * Results for several questions in one round trip.
 *
 * The stream detail page used to await getResultsForQuestion() inside a loop,
 * which is one sequential query per question — a stream with 20 questions meant
 * 20 round trips before the page could render.
 */
