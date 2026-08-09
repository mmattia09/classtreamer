import { describe, expect, test } from "bun:test";

import { buildResults } from "@/lib/results";

type AnswerFixture = {
  id: string;
  value: unknown;
  classYear?: number | null;
  classSection?: string | null;
  createdAt?: Date;
};

/**
 * buildResults() takes a Prisma question with its answers. Only the fields it
 * reads are provided here; the cast keeps the fixtures readable.
 */
function question(
  inputType: string,
  answers: AnswerFixture[],
  extra: { options?: string[]; settings?: Record<string, number> } = {},
) {
  return {
    id: "q1",
    text: "Domanda",
    inputType,
    options: extra.options ?? null,
    settings: extra.settings ?? null,
    answers: answers.map((answer, index) => ({
      classYear: null,
      classSection: null,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      ...answer,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("single choice", () => {
  test("counts each option and includes those with no votes", () => {
    const results = buildResults(
      question(
        "SINGLE_CHOICE",
        [
          { id: "a1", value: { value: "Bene" } },
          { id: "a2", value: { value: "Bene" } },
          { id: "a3", value: { value: "Male" } },
        ],
        { options: ["Bene", "Male", "Boh"] },
      ),
    );

    expect(results.totalAnswers).toBe(3);
    expect(results.entries).toEqual([
      { label: "Bene", value: 2, percentage: 67 },
      { label: "Male", value: 1, percentage: 33 },
      { label: "Boh", value: 0, percentage: 0 },
    ]);
  });

  test("no answers yields zero percentages rather than NaN", () => {
    const results = buildResults(question("SINGLE_CHOICE", [], { options: ["A", "B"] }));
    expect(results.totalAnswers).toBe(0);
    expect(results.entries.every((entry) => entry.percentage === 0)).toBe(true);
  });
});

describe("multiple choice", () => {
  test("counts every selected value", () => {
    const results = buildResults(
      question(
        "MULTIPLE_CHOICE",
        [
          { id: "a1", value: { values: ["A", "B"] } },
          { id: "a2", value: { values: ["B"] } },
        ],
        { options: ["A", "B", "C"] },
      ),
    );

    expect(results.totalAnswers).toBe(2);
    expect(results.entries).toEqual([
      { label: "A", value: 1, percentage: 50 },
      { label: "B", value: 2, percentage: 100 },
      { label: "C", value: 0, percentage: 0 },
    ]);
  });
});

describe("scale", () => {
  test("buckets every step and averages", () => {
    const results = buildResults(
      question(
        "SCALE",
        [
          { id: "a1", value: { value: 1 } },
          { id: "a2", value: { value: 3 } },
          { id: "a3", value: { value: 5 } },
        ],
        { settings: { min: 1, max: 5, step: 1 } },
      ),
    );

    expect(results.entries.map((entry) => entry.label)).toEqual(["1", "2", "3", "4", "5"]);
    expect(results.average).toBe(3);
    expect(results.scale).toEqual({ min: 1, max: 5, step: 1 });
  });

  // A step of 0 would make the bucket loop run forever and hang the request.
  test("a zero step is clamped instead of looping forever", () => {
    const results = buildResults(
      question("SCALE", [{ id: "a1", value: { value: 1 } }], {
        settings: { min: 1, max: 5, step: 0 },
      }),
    );
    expect(results.entries.length).toBeGreaterThan(0);
    expect(results.entries.length).toBeLessThanOrEqual(1001);
  });

  test("a max below min is clamped", () => {
    const results = buildResults(
      question("SCALE", [], { settings: { min: 5, max: 1, step: 1 } }),
    );
    expect(results.scale!.max).toBeGreaterThan(results.scale!.min);
  });

  test("non-numeric answers are ignored by the average", () => {
    const results = buildResults(
      question(
        "SCALE",
        [
          { id: "a1", value: { value: 2 } },
          { id: "a2", value: { value: "nope" } },
        ],
        { settings: { min: 1, max: 5, step: 1 } },
      ),
    );
    // Both answers count towards the total, only the numeric one towards the sum.
    expect(results.totalAnswers).toBe(2);
    expect(results.average).toBe(1);
  });
});

describe("word cloud", () => {
  test("tokenises, lowercases and counts words", () => {
    const results = buildResults(
      question("WORD_COUNT", [
        { id: "a1", value: { text: "Scuola bella" } },
        { id: "a2", value: { text: "scuola" } },
      ]),
    );

    expect(results.entries).toEqual([
      { label: "scuola", value: 2 },
      { label: "bella", value: 1 },
    ]);
  });

  test("keeps accented letters as part of a word", () => {
    const results = buildResults(
      question("WORD_COUNT", [{ id: "a1", value: { text: "città" } }]),
    );
    expect(results.entries).toEqual([{ label: "città", value: 1 }]);
  });
});

describe("open answers", () => {
  test("returns submissions newest first", () => {
    const results = buildResults(
      question("OPEN", [
        { id: "a1", value: { text: "prima" } },
        { id: "a2", value: { text: "seconda" } },
      ]),
    );

    expect(results.latestAnswers).toEqual(["seconda", "prima"]);
    expect(results.latestSubmissions?.map((entry) => entry.id)).toEqual(["a2", "a1"]);
  });

  test("labels the class when both parts are present", () => {
    const results = buildResults(
      question("OPEN", [
        { id: "a1", value: { text: "x" }, classYear: 1, classSection: "A" },
        { id: "a2", value: { text: "y" }, classYear: null, classSection: null },
      ]),
    );

    const labels = results.latestSubmissions?.map((entry) => entry.classLabel);
    expect(labels).toEqual([null, "1A"]);
  });
});

describe("answer filtering", () => {
  // The OBS overlay shows only the submissions the control room picked.
  test("restricts the tally to the given answer ids", () => {
    const results = buildResults(
      question("OPEN", [
        { id: "a1", value: { text: "uno" } },
        { id: "a2", value: { text: "due" } },
        { id: "a3", value: { text: "tre" } },
      ]),
      ["a1", "a3"],
    );

    expect(results.totalAnswers).toBe(2);
    expect(results.latestAnswers).toEqual(["tre", "uno"]);
  });

  test("an empty id list means no filtering", () => {
    const results = buildResults(
      question("OPEN", [{ id: "a1", value: { text: "uno" } }]),
      [],
    );
    expect(results.totalAnswers).toBe(1);
  });
});
