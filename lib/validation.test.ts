import { describe, expect, test } from "bun:test";

import {
  answerSchema,
  audienceQuestionSchema,
  createStreamSchema,
  embedStateSchema,
  httpUrl,
  iconSource,
  normalizeQuestionSettings,
} from "@/lib/validation";

describe("httpUrl", () => {
  test("accepts http and https", () => {
    expect(httpUrl.safeParse("https://example.com/embed").success).toBe(true);
    expect(httpUrl.safeParse("http://example.com").success).toBe(true);
  });

  // embedUrl is rendered into an iframe src, so a scheme that executes must
  // never get through.
  test.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "vbscript:msgbox(1)",
    "not a url",
    "",
  ])("rejects %p", (value) => {
    expect(httpUrl.safeParse(value).success).toBe(false);
  });
});

describe("iconSource", () => {
  test("accepts an absolute same-origin path", () => {
    expect(iconSource.safeParse("/logo.png").success).toBe(true);
  });

  test("accepts an http(s) URL", () => {
    expect(iconSource.safeParse("https://example.com/logo.png").success).toBe(true);
  });

  test("accepts an empty value, meaning fall back to the default", () => {
    expect(iconSource.safeParse("").success).toBe(true);
  });

  test("rejects a javascript: URL", () => {
    expect(iconSource.safeParse("javascript:alert(1)").success).toBe(false);
  });

  test("rejects a bare relative path", () => {
    expect(iconSource.safeParse("logo.png").success).toBe(false);
  });
});

describe("createStreamSchema", () => {
  const valid = {
    title: "Assemblea",
    embedUrl: "https://example.com/embed",
    targetClassIds: [],
    questions: [],
  };

  test("accepts a minimal stream", () => {
    expect(createStreamSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects an empty title", () => {
    expect(createStreamSchema.safeParse({ ...valid, title: "   " }).success).toBe(false);
  });

  // Reaching Prisma with an unknown enum used to surface as a 500 from the
  // driver rather than a 400.
  test("rejects an unknown inputType", () => {
    const result = createStreamSchema.safeParse({
      ...valid,
      questions: [{ text: "q", inputType: "PWNED", audienceType: "CLASS" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects an unknown audienceType", () => {
    const result = createStreamSchema.safeParse({
      ...valid,
      questions: [{ text: "q", inputType: "OPEN", audienceType: "EVERYONE" }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects a negative timer", () => {
    const result = createStreamSchema.safeParse({
      ...valid,
      questions: [{ text: "q", inputType: "OPEN", audienceType: "CLASS", timerSeconds: -5 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid scheduledAt", () => {
    expect(createStreamSchema.safeParse({ ...valid, scheduledAt: "non-una-data" }).success).toBe(
      false,
    );
  });

  test("accepts an empty scheduledAt, meaning no schedule", () => {
    expect(createStreamSchema.safeParse({ ...valid, scheduledAt: "" }).success).toBe(true);
  });
});

describe("answerSchema", () => {
  test("accepts a class-tagged answer", () => {
    const result = answerSchema.safeParse({ classYear: 1, classSection: "A", value: { value: "x" } });
    expect(result.success).toBe(true);
  });

  test("accepts an answer with no class, as sent from a phone", () => {
    expect(answerSchema.safeParse({ value: { text: "x" } }).success).toBe(true);
  });

  // A non-integer year used to reach Prisma and come back as a 500.
  test("rejects a non-numeric classYear", () => {
    expect(answerSchema.safeParse({ classYear: "abc", value: {} }).success).toBe(false);
  });

  test("rejects a year outside the school range", () => {
    expect(answerSchema.safeParse({ classYear: 99, value: {} }).success).toBe(false);
  });
});

describe("audienceQuestionSchema", () => {
  const valid = { text: "Una domanda vera", streamId: "abc" };

  test("accepts a well-formed question", () => {
    expect(audienceQuestionSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects text that is too short", () => {
    expect(audienceQuestionSchema.safeParse({ ...valid, text: "ehi" }).success).toBe(false);
  });

  test("rejects text over the limit", () => {
    expect(audienceQuestionSchema.safeParse({ ...valid, text: "a".repeat(281) }).success).toBe(false);
  });

  // The client sends null when nothing is live; the route answers 409.
  test("accepts a null streamId", () => {
    expect(audienceQuestionSchema.safeParse({ ...valid, streamId: null }).success).toBe(true);
  });
});

describe("embedStateSchema", () => {
  test("accepts each valid shape", () => {
    expect(embedStateSchema.safeParse({ kind: "none" }).success).toBe(true);
    expect(embedStateSchema.safeParse({ kind: "question", questionId: "q1" }).success).toBe(true);
    expect(
      embedStateSchema.safeParse({ kind: "viewer-question", viewerQuestionId: "v1" }).success,
    ).toBe(true);
  });

  test("rejects an unknown kind", () => {
    expect(embedStateSchema.safeParse({ kind: "pwn" }).success).toBe(false);
  });

  test("rejects a question state without an id", () => {
    expect(embedStateSchema.safeParse({ kind: "question" }).success).toBe(false);
  });
});

describe("normalizeQuestionSettings", () => {
  test("applies scale defaults", () => {
    expect(normalizeQuestionSettings("SCALE", undefined)).toEqual({ min: 1, max: 5, step: 1 });
  });

  // A zero step would make the results bucket loop run forever.
  // The return type is a union across question types, so scale settings are
  // narrowed before asserting on them.
  function scaleSettings(input: Record<string, number>) {
    return normalizeQuestionSettings("SCALE", input) as { min: number; max: number; step: number };
  }

  test("clamps a zero step", () => {
    expect(scaleSettings({ min: 1, max: 5, step: 0 }).step).toBe(1);
  });

  test("clamps a max below min", () => {
    const settings = scaleSettings({ min: 5, max: 1, step: 1 });
    expect(settings.max).toBeGreaterThan(settings.min);
  });

  test("applies the word-cloud default", () => {
    expect(normalizeQuestionSettings("WORD_COUNT", undefined)).toEqual({ maxWords: 3 });
  });

  test("returns nothing for types that carry no settings", () => {
    expect(normalizeQuestionSettings("OPEN", undefined)).toBeUndefined();
    expect(normalizeQuestionSettings("SINGLE_CHOICE", { min: 1 })).toBeUndefined();
  });
});
