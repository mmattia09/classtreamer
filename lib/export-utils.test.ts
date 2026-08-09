import { describe, expect, test } from "bun:test";

import { escapeCsv, formatAnswerValue, formatClassLabel } from "@/lib/export-utils";

describe("escapeCsv", () => {
  test("leaves a plain value untouched", () => {
    expect(escapeCsv("Bene")).toBe("Bene");
  });

  test("quotes values containing a comma", () => {
    expect(escapeCsv("uno, due")).toBe('"uno, due"');
  });

  test("doubles embedded quotes", () => {
    expect(escapeCsv('dice "ciao"')).toBe('"dice ""ciao"""');
  });

  test("collapses newlines to spaces", () => {
    expect(escapeCsv("prima\nseconda")).toBe("prima seconda");
    expect(escapeCsv("prima\r\nseconda")).toBe("prima seconda");
  });

  // A cell starting with one of these is executed as a formula by Excel and
  // Google Sheets when the export is opened.
  describe("formula injection", () => {
    for (const prefix of ["=", "+", "-", "@"]) {
      test(`neutralises a leading "${prefix}"`, () => {
        const value = `${prefix}HYPERLINK("http://evil.example","click")`;
        const escaped = escapeCsv(value);
        expect(escaped.startsWith("'") || escaped.startsWith(`"'`)).toBe(true);
      });
    }

    // Leading whitespace is trimmed before the check, which disarms a leading
    // tab on its own. What matters is that trimming cannot expose a dangerous
    // character without it being caught.
    test("trims a leading tab", () => {
      expect(escapeCsv("\tcmd")).toBe("cmd");
    });

    test("still guards a dangerous character revealed by trimming", () => {
      expect(escapeCsv("\t=1+1")).toBe("'=1+1");
      expect(escapeCsv("  =1+1")).toBe("'=1+1");
    });

    test("does not touch a value with the character in the middle", () => {
      expect(escapeCsv("1+1")).toBe("1+1");
    });
  });
});

describe("formatClassLabel", () => {
  test("joins year and section", () => {
    expect(formatClassLabel(1, "A")).toBe("1A");
  });

  test("renders year 0 as an asterisk", () => {
    expect(formatClassLabel(0, "INSEGNANTI")).toBe("*INSEGNANTI");
  });

  test("returns an empty string when either part is missing", () => {
    expect(formatClassLabel(null, "A")).toBe("");
    expect(formatClassLabel(1, null)).toBe("");
    expect(formatClassLabel(undefined, undefined)).toBe("");
  });
});

describe("formatAnswerValue", () => {
  test("reads text for open and word-cloud answers", () => {
    expect(formatAnswerValue("OPEN", { text: "una risposta" })).toBe("una risposta");
    expect(formatAnswerValue("WORD_COUNT", { text: "parola" })).toBe("parola");
  });

  test("reads the numeric value for a scale answer", () => {
    expect(formatAnswerValue("SCALE", { value: 4 })).toBe("4");
  });

  test("joins multiple-choice values", () => {
    expect(formatAnswerValue("MULTIPLE_CHOICE", { values: ["A", "B"] })).toBe("A, B");
  });

  test("falls back to an empty string on a malformed value", () => {
    expect(formatAnswerValue("OPEN", {})).toBe("");
    expect(formatAnswerValue("MULTIPLE_CHOICE", { values: "nope" })).toBe("");
  });
});
