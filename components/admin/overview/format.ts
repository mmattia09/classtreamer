import { getYearLabel } from "@/lib/classes";
import type { ViewerQuestionPayload } from "@/lib/types";

export const INPUT_TYPE_LABELS: Record<string, string> = {
  OPEN: "Aperta",
  WORD_COUNT: "Word cloud",
  SCALE: "Scala",
  SINGLE_CHOICE: "Singola",
  MULTIPLE_CHOICE: "Multipla",
};

export const AUDIENCE_TYPE_LABELS: Record<string, string> = {
  CLASS: "Classe",
  INDIVIDUAL: "Individuale",
};

export function formatViewerQuestionClassLabel(entry: ViewerQuestionPayload) {
  if (!entry.classYear || !entry.classSection) return "Pubblico";
  return `${getYearLabel(entry.classYear)}${entry.classSection}`;
}

export function formatLiveElapsed(startedAt: string | null | undefined, now: number) {
  if (!startedAt) return "00:00";
  const totalSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatQuestionMeta(inputType: string, audienceType?: string) {
  const inputLabel = INPUT_TYPE_LABELS[inputType] ?? inputType;
  if (!audienceType) return inputLabel;
  return `${inputLabel} · ${AUDIENCE_TYPE_LABELS[audienceType] ?? audienceType}`;
}
