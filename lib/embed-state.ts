"use server";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { buildResults, mapQuestion } from "@/lib/questions";
import type { EmbedPayload, StoredEmbedState } from "@/lib/types";

const EMBED_STATE_DIR = path.join(process.cwd(), ".data");
const EMBED_STATE_FILE = path.join(EMBED_STATE_DIR, "embed-state.json");

const DEFAULT_EMBED_STATE: StoredEmbedState = { kind: "none" };

async function ensureEmbedStateDir() {
  await mkdir(EMBED_STATE_DIR, { recursive: true });
}

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
    const raw = await readFile(EMBED_STATE_FILE, "utf8");
    return normalizeStoredEmbedState(JSON.parse(raw));
  } catch {
    return DEFAULT_EMBED_STATE;
  }
}

export async function setStoredEmbedState(state: StoredEmbedState) {
  await ensureEmbedStateDir();
  await writeFile(EMBED_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
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
