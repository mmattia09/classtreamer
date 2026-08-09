import { describe, expect, test } from "bun:test";

import {
  compactClassesInput,
  getYearLabel,
  groupClassesByYear,
  parseClassesInput,
  type ClassEntry,
} from "@/lib/classes";

function sorted(entries: ClassEntry[]) {
  return [...entries]
    .map(({ year, section }) => `${year}${section}`)
    .sort();
}

describe("parseClassesInput", () => {
  test("expands a letter range", () => {
    expect(sorted(parseClassesInput("1A-E"))).toEqual(["1A", "1B", "1C", "1D", "1E"]);
  });

  test("expands a reversed range the same way", () => {
    expect(sorted(parseClassesInput("1E-A"))).toEqual(sorted(parseClassesInput("1A-E")));
  });

  test("a range of one letter yields that single class", () => {
    expect(sorted(parseClassesInput("2C-C"))).toEqual(["2C"]);
  });

  test("combines ranges and single classes, de-duplicating overlaps", () => {
    expect(sorted(parseClassesInput("3A-D,3E,3A"))).toEqual(["3A", "3B", "3C", "3D", "3E"]);
  });

  test("classes with no leading digit become year 0", () => {
    const entries = parseClassesInput("INSEGNANTI");
    expect(entries).toEqual([{ year: 0, section: "INSEGNANTI", displayName: null }]);
  });

  test("uppercases sections and trims whitespace", () => {
    expect(sorted(parseClassesInput(" 2a , 2b "))).toEqual(["2A", "2B"]);
  });

  test("supports multi-character sections", () => {
    expect(sorted(parseClassesInput("2IA"))).toEqual(["2IA"]);
  });

  test("ignores empty tokens", () => {
    expect(parseClassesInput(",, ,")).toEqual([]);
    expect(parseClassesInput("")).toEqual([]);
  });
});

describe("compactClassesInput", () => {
  test("collapses a consecutive run into a range", () => {
    expect(compactClassesInput(parseClassesInput("1A,1B,1C"))).toBe("1A-C");
  });

  test("leaves a lone letter alone", () => {
    expect(compactClassesInput(parseClassesInput("1A"))).toBe("1A");
  });

  test("splits non-consecutive letters into separate entries", () => {
    expect(compactClassesInput(parseClassesInput("1A,1B,1D"))).toBe("1A-B, 1D");
  });

  test("sorts years ascending and puts non-numbered classes last", () => {
    const input = parseClassesInput("INSEGNANTI,3A,1A");
    expect(compactClassesInput(input)).toBe("1A, 3A, INSEGNANTI");
  });

  test("keeps multi-character sections out of ranges", () => {
    expect(compactClassesInput(parseClassesInput("2A,2B,2IA"))).toBe("2A-B, 2IA");
  });
});

describe("parse and compact round-trip", () => {
  // The settings form shows compactClassesInput() of what is stored and feeds
  // the result back through parseClassesInput() on save, so a value that does
  // not survive the round-trip silently changes the class list.
  const inputs = [
    "1A-E",
    "1A-E, 2A-E, 3A-D, 3E",
    "INSEGNANTI",
    "1A, 3A, INSEGNANTI",
    "2A-B, 2IA",
    "5A",
  ];

  for (const input of inputs) {
    test(`"${input}" is stable`, () => {
      const once = parseClassesInput(input);
      const twice = parseClassesInput(compactClassesInput(once));
      expect(sorted(twice)).toEqual(sorted(once));
      expect(compactClassesInput(twice)).toBe(compactClassesInput(once));
    });
  }
});

describe("getYearLabel", () => {
  test("renders year 0 as an asterisk", () => {
    expect(getYearLabel(0)).toBe("*");
  });

  test("renders numbered years as digits", () => {
    expect(getYearLabel(3)).toBe("3");
  });
});

describe("groupClassesByYear", () => {
  test("groups by year with sections sorted", () => {
    const grouped = groupClassesByYear(parseClassesInput("2C,1B,2A,1A"));
    expect(grouped.get(1)?.map((entry) => entry.section)).toEqual(["A", "B"]);
    expect(grouped.get(2)?.map((entry) => entry.section)).toEqual(["A", "C"]);
  });
});
