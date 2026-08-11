import { describe, expect, test } from "bun:test";

import {
  FEATURED_MAX_CHARS,
  clampFeaturedText,
  featuredAnswerFontVw,
  secondaryAnswerFontVw,
} from "@/lib/overlay-typography";

describe("featuredAnswerFontVw", () => {
  test("a short answer gets the largest size", () => {
    expect(featuredAnswerFontVw("Va bene così")).toBe(5.2);
  });

  test("size decreases as the answer gets longer", () => {
    const sizes = [20, 70, 120, 200, 400].map((length) =>
      featuredAnswerFontVw("a".repeat(length)),
    );
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  test("never returns a size that would overflow the canvas", () => {
    for (const length of [1, 50, 150, 500, 5000]) {
      const size = featuredAnswerFontVw("a".repeat(length));
      expect(size).toBeGreaterThanOrEqual(2.1);
      expect(size).toBeLessThanOrEqual(5.2);
    }
  });

  test("ignores surrounding whitespace when measuring", () => {
    expect(featuredAnswerFontVw("   corta   ")).toBe(featuredAnswerFontVw("corta"));
  });
});

describe("secondaryAnswerFontVw", () => {
  test("fewer answers are shown larger", () => {
    expect(secondaryAnswerFontVw(2)).toBeGreaterThan(secondaryAnswerFontVw(5));
    expect(secondaryAnswerFontVw(5)).toBeGreaterThan(secondaryAnswerFontVw(8));
  });

  // 1.15vw is about 22px on a 1920 canvas; below that it stops being readable
  // from the back of a room.
  test("never goes below a legible size", () => {
    for (const count of [1, 6, 20, 100]) {
      expect(secondaryAnswerFontVw(count)).toBeGreaterThanOrEqual(1.15);
    }
  });
});

describe("clampFeaturedText", () => {
  test("leaves a short answer untouched", () => {
    expect(clampFeaturedText("Una risposta breve")).toBe("Una risposta breve");
  });

  test("trims surrounding whitespace", () => {
    expect(clampFeaturedText("  spazi  ")).toBe("spazi");
  });

  test("truncates an over-long answer", () => {
    const long = "parola ".repeat(200);
    const result = clampFeaturedText(long);
    expect(result.length).toBeLessThanOrEqual(FEATURED_MAX_CHARS + 1);
    expect(result.endsWith("…")).toBe(true);
  });

  test("cuts on a word boundary", () => {
    const long = `${"parola ".repeat(60)}finale`;
    const result = clampFeaturedText(long, 50);
    expect(result.endsWith("…")).toBe(true);
    // No half-word before the ellipsis.
    expect(result.replace("…", "").endsWith("parola")).toBe(true);
  });

  test("falls back to a hard cut when there is no space to break on", () => {
    const result = clampFeaturedText("a".repeat(100), 20);
    expect(result).toBe(`${"a".repeat(20)}…`);
  });
});
