import { z } from "zod";

/**
 * Schemas for every write endpoint. Before these existed the routes cast the
 * request body straight into Prisma (`payload.inputType as never`), so a
 * malformed enum surfaced as a 500 from the database driver, and URLs were
 * stored unchecked — a `javascript:` embedUrl ends up in an iframe src.
 */

const QUESTION_INPUT_TYPES = [
  "OPEN",
  "WORD_COUNT",
  "SCALE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
] as const;

const AUDIENCE_TYPES = ["CLASS", "INDIVIDUAL"] as const;

/** Only http(s) — blocks javascript:, data: and file: URLs. */
export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "Deve essere un URL http(s) valido");

/** An http(s) URL or a same-origin absolute path such as /logo.png. */
export const iconSource = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value === "" || value.startsWith("/") || httpUrl.safeParse(value).success,
    "Deve essere un URL http(s) o un percorso che inizia con /",
  );

const questionSettings = z.record(z.string(), z.number().finite()).optional();

const questionBase = {
  text: z.string().trim().min(1, "Testo obbligatorio").max(500),
  inputType: z.enum(QUESTION_INPUT_TYPES),
  audienceType: z.enum(AUDIENCE_TYPES),
  // Capped at 2 hours: the timer drives a client-side countdown.
  timerSeconds: z.number().int().positive().max(7200).nullish(),
  options: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  settings: questionSettings,
};

export const newQuestionSchema = z.object(questionBase);

/** Questions coming back from the editor carry an id for existing rows. */
export const editedQuestionSchema = z.object({
  id: z.string().max(64).optional(),
  ...questionBase,
});

const streamBase = {
  title: z.string().trim().min(1, "Titolo obbligatorio").max(200),
  embedUrl: httpUrl,
  scheduledAt: z
    .string()
    .trim()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), "Data non valida")
    .optional()
    .nullable(),
  targetClassIds: z.array(z.string().max(64)).max(500).default([]),
};

export const createStreamSchema = z.object({
  ...streamBase,
  questions: z.array(editedQuestionSchema).max(200).default([]),
});

export const updateStreamSchema = createStreamSchema;

export const appSettingsSchema = z.object({
  appName: z.string().trim().min(1).max(120).optional(),
  appIcon: iconSource.optional(),
});

export const classesInputSchema = z.object({
  classes: z.string().max(2000).optional(),
  year: z.coerce.number().int().min(0).max(5).optional(),
  section: z.string().trim().min(1).max(32).optional(),
  displayName: z.string().trim().max(64).optional(),
});

export const answerSchema = z.object({
  classYear: z.number().int().min(0).max(5).nullish(),
  classSection: z.string().trim().min(1).max(32).nullish(),
  value: z.unknown(),
});

export const audienceQuestionSchema = z.object({
  text: z.string().trim().min(4, "Testo troppo corto").max(280),
  classYear: z.number().int().min(0).max(5).nullish(),
  classSection: z.string().trim().min(1).max(32).nullish(),
  // Nullable on purpose: the client sends null when no stream is live, and the
  // route answers 409 with a message the UI keys off.
  streamId: z.string().min(1).max(64).nullish(),
});

export const embedStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({
    kind: z.literal("question"),
    questionId: z.string().min(1).max(64),
    selectedAnswerIds: z.array(z.string().max(64)).max(2000).optional(),
    featuredAnswerId: z.string().max(64).nullish(),
  }),
  z.object({
    kind: z.literal("viewer-question"),
    viewerQuestionId: z.string().min(1).max(64),
  }),
]);

/**
 * Settings kept for a question, by input type. Shared by the three endpoints
 * that write questions so the defaults cannot drift apart between them.
 */
export function normalizeQuestionSettings(
  inputType: (typeof QUESTION_INPUT_TYPES)[number],
  settings?: Record<string, number>,
) {
  if (inputType === "SCALE") {
    const min = settings?.min ?? 1;
    const max = settings?.max ?? 5;
    const step = settings?.step ?? 1;
    return {
      min,
      // Guard against min >= max, which would make buildResults() loop forever
      // while filling the bucket map.
      max: max > min ? max : min + 1,
      step: step > 0 ? step : 1,
    };
  }

  if (inputType === "WORD_COUNT") {
    const maxWords = settings?.maxWords ?? 3;
    return { maxWords: maxWords > 0 ? Math.floor(maxWords) : 3 };
  }

  return undefined;
}

/**
 * Turn a request body into a typed value, or into the 400 response to return.
 * Keeps the routes free of repeated try/catch around request.json().
 */
export async function parseJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<
  { ok: true; data: z.infer<T> } | { ok: false; error: string; issues: z.core.$ZodIssue[] }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "Corpo della richiesta non valido", issues: [] };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Dati non validi",
      issues: result.error.issues,
    };
  }

  return { ok: true, data: result.data };
}
