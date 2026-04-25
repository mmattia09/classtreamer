import type { QuestionPayload } from "@/lib/types";

type TimerQuestion = Pick<QuestionPayload, "openedAt" | "timerSeconds"> | null | undefined;

export type QuestionTimerState =
  | { kind: "none" }
  | { kind: "pending" }
  | { kind: "active"; remainingSeconds: number }
  | { kind: "expired" };

export function getQuestionTimerState(question: TimerQuestion, now: number | null): QuestionTimerState {
  if (!question?.timerSeconds) return { kind: "none" };
  if (!question.openedAt || now === null) return { kind: "pending" };

  const expiresAt = new Date(question.openedAt).getTime() + question.timerSeconds * 1000;
  const remainingSeconds = Math.ceil((expiresAt - now) / 1000);

  if (remainingSeconds <= 0) return { kind: "expired" };
  return { kind: "active", remainingSeconds };
}

export function isQuestionExpiredAt(
  question: TimerQuestion,
  now: number,
) {
  return getQuestionTimerState(question, now).kind === "expired";
}

export function formatTimerRemaining(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
