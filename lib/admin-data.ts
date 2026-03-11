import { prisma } from "@/lib/prisma";
import { getActiveQuestion, getCurrentStreamStatus, getResultsForQuestion } from "@/lib/questions";

export type StreamSummary = {
  id: string;
  title: string;
  embedUrl: string;
  status: string;
  scheduledAt: string | null;
  questionsCount: number;
};

export type QuestionSummary = {
  id: string;
  text: string;
  inputType: string;
  audienceType: string;
  status: string;
  timerSeconds: number | null;
  order: number;
  createdAt: string;
};

export type CurrentStreamSummary = {
  id: string;
  title: string;
  embedUrl: string;
  status: string;
  scheduledAt: string | null;
  questions: QuestionSummary[];
};

export type QuestionArchiveEntry = {
  id: string;
  text: string;
  inputType: string;
  audienceType: string;
  status: string;
  createdAt: string;
  streamTitle: string | null;
};

export async function getAdminOverview() {
  const streamStatus = await getCurrentStreamStatus();
  const activeQuestion = await getActiveQuestion();
  const results = activeQuestion ? await getResultsForQuestion(activeQuestion.id) : null;

  const streams = await prisma.stream.findMany({
    include: {
      questions: {
        select: { id: true },
      },
    },
    orderBy: [{ status: "asc" }, { scheduledAt: "desc" }, { createdAt: "desc" }],
  });

  const streamSummaries: StreamSummary[] = streams.map((stream) => ({
    id: stream.id,
    title: stream.title,
    embedUrl: stream.embedUrl,
    status: stream.status,
    scheduledAt: stream.scheduledAt ? stream.scheduledAt.toISOString() : null,
    questionsCount: stream.questions.length,
  }));

  let currentStream: CurrentStreamSummary | null = null;
  if (streamStatus.status !== "no_stream") {
    const stream = await prisma.stream.findUnique({
      where: { id: streamStatus.streamId },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (stream) {
      currentStream = {
        id: stream.id,
        title: stream.title,
        embedUrl: stream.embedUrl,
        status: stream.status,
        scheduledAt: stream.scheduledAt ? stream.scheduledAt.toISOString() : null,
        questions: stream.questions.map((question) => ({
          id: question.id,
          text: question.text,
          inputType: question.inputType,
          audienceType: question.audienceType,
          status: question.status,
          timerSeconds: question.timerSeconds,
          order: question.order,
          createdAt: question.createdAt.toISOString(),
        })),
      };
    }
  }

  const archive = await prisma.question.findMany({
    include: {
      stream: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const questionArchive: QuestionArchiveEntry[] = archive.map((question) => ({
    id: question.id,
    text: question.text,
    inputType: question.inputType,
    audienceType: question.audienceType,
    status: question.status,
    createdAt: question.createdAt.toISOString(),
    streamTitle: question.stream?.title ?? null,
  }));

  return {
    streamStatus,
    activeQuestion,
    results,
    currentStream,
    streams: {
      upcoming: streamSummaries
        .filter((stream) => stream.status === "SCHEDULED")
        .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? "")),
      past: streamSummaries
        .filter((stream) => stream.status === "ENDED")
        .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? "")),
      drafts: streamSummaries.filter((stream) => stream.status === "DRAFT"),
    },
    questionArchive,
  };
}
