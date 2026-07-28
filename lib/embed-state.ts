// NOTE: this module must not carry a top-level "use server" directive. That
// directive turns every export into a callable server action, which would have
// exposed setStoredEmbedState() as an unauthenticated endpoint able to change
// what the OBS overlay shows. The functions here are called from server
// components and from route handlers that check the admin session themselves.
import "server-only";

import { prisma } from "@/lib/prisma";
import { buildResults, mapQuestion } from "@/lib/questions";
import type { EmbedPayload, StoredEmbedState } from "@/lib/types";

const EMBED_STATE_ID = "singleton";

const DEFAULT_EMBED_STATE: StoredEmbedState = { kind: "none" };

function normalizeStoredEmbedState(value: unknown): StoredEmbedState {
  if (!value || typeof value !== "object") {
    return DEFAULT_EMBED_STATE;
  }

  if ((value as { kind?: string }).kind === "question" && typeof (value as { questionId?: string }).questionId === "string") {
    return {
      kind: "question",
      questionId: (value as { questionId: string }).questionId,
      selectedAnswerIds: Array.isArray((value as { selectedAnswerIds?: string[] }).selectedAnswerIds)
        ? (value as { selectedAnswerIds: string[] }).selectedAnswerIds
        : undefined,
      featuredAnswerId:
        typeof (value as { featuredAnswerId?: string | null }).featuredAnswerId === "string" ||
        (value as { featuredAnswerId?: string | null }).featuredAnswerId === null
          ? ((value as { featuredAnswerId?: string | null }).featuredAnswerId ?? null)
          : undefined,
    };
  }

  if (
    (value as { kind?: string }).kind === "viewer-question" &&
    typeof (value as { viewerQuestionId?: string }).viewerQuestionId === "string"
  ) {
    return {
      kind: "viewer-question",
      viewerQuestionId: (value as { viewerQuestionId: string }).viewerQuestionId,
    };
  }

  return DEFAULT_EMBED_STATE;
}

export async function getStoredEmbedState(): Promise<StoredEmbedState> {
  try {
    const row = await prisma.embedState.findUnique({ where: { id: EMBED_STATE_ID } });
    return normalizeStoredEmbedState(row?.state);
  } catch {
    // The overlay should degrade to "nothing on screen" rather than error out.
    return DEFAULT_EMBED_STATE;
  }
}

export async function setStoredEmbedState(state: StoredEmbedState) {
  await prisma.embedState.upsert({
    where: { id: EMBED_STATE_ID },
    update: { state },
    create: { id: EMBED_STATE_ID, state },
  });
}

export async function clearStoredEmbedState() {
  await setStoredEmbedState(DEFAULT_EMBED_STATE);
}

export async function resolveEmbedPayload(): Promise<EmbedPayload> {
  const state = await getStoredEmbedState();

  if (state.kind === "question") {
    const question = await prisma.question.findUnique({
      where: { id: state.questionId },
      include: {
        answers: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!question) {
      return { kind: "none" };
    }

    return {
      kind: "question",
      question: mapQuestion(question),
      results: buildResults(question, state.selectedAnswerIds),
      featuredAnswerId: state.featuredAnswerId ?? null,
      selectedAnswerIds: state.selectedAnswerIds,
    };
  }

  if (state.kind === "viewer-question") {
    const viewerQuestion = await prisma.viewerQuestion.findUnique({
      where: { id: state.viewerQuestionId },
      include: {
        stream: true,
      },
    });

    if (!viewerQuestion) {
      return { kind: "none" };
    }

    return {
      kind: "viewer-question",
      viewerQuestion: {
        id: viewerQuestion.id,
        streamId: viewerQuestion.streamId,
        streamTitle: viewerQuestion.stream?.title ?? null,
        text: viewerQuestion.text,
        classYear: viewerQuestion.classYear ?? null,
        classSection: viewerQuestion.classSection ?? null,
        createdAt: viewerQuestion.createdAt.toISOString(),
      },
    };
  }

  return { kind: "none" };
}
