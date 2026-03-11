import { QuestionInputType } from "@prisma/client";

import { getYearLabel } from "@/lib/classes";

export function escapeCsv(value: string) {
  const normalized = value.replace(/\r?\n/g, " ").trim();
  if (/["\n,]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

export function formatClassLabel(year?: number | null, section?: string | null) {
  if (year === null || year === undefined || !section) {
    return "";
  }
  return `${getYearLabel(year)}${section}`;
}

export function formatAnswerValue(inputType: QuestionInputType, value: unknown) {
  if (inputType === QuestionInputType.OPEN || inputType === QuestionInputType.WORD_COUNT) {
    return String((value as { text?: string }).text ?? "");
  }

  if (inputType === QuestionInputType.SCALE) {
    return String((value as { value?: number }).value ?? "");
  }

  if (inputType === QuestionInputType.MULTIPLE_CHOICE) {
    const values = Array.isArray((value as { values?: string[] }).values)
      ? ((value as { values?: string[] }).values as string[])
      : [];
    return values.join(", ");
  }

  return String((value as { value?: string }).value ?? "");
}
