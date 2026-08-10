import { describe, expect, test } from "bun:test";

import { buildWordCloud, colorIndexFor } from "@/lib/word-cloud";

const equalCounts = ["uno", "due", "tre", "quattro", "cinque"].map((label) => ({
  label,
  value: 1,
}));

describe("buildWordCloud", () => {
  test("no entries yields nothing", () => {
    expect(buildWordCloud([])).toEqual([]);
  });

  test("drops empty labels and zero counts", () => {
    const items = buildWordCloud([
      { label: "valida", value: 2 },
      { label: "   ", value: 5 },
      { label: "zero", value: 0 },
    ]);
    expect(items.map((item) => item.label)).toEqual(["valida"]);
  });

  // The bug this rewrite exists for: with every word appearing once, the old
  // sizing gave every word the maximum size and the cloud became a wall of
  // identical text.
  describe("when every word has the same count", () => {
    const items = buildWordCloud(equalCounts);

    test("they share a size", () => {
      const sizes = new Set(items.map((item) => item.fontSize));
      expect(sizes.size).toBe(1);
    });

    test("that size is in the middle of the range, not the maximum", () => {
      const withOneDominant = buildWordCloud([
        { label: "dominante", value: 10 },
        ...equalCounts,
      ]);
      const largest = Math.max(...withOneDominant.map((item) => item.fontSize));
      expect(items[0].fontSize).toBeLessThan(largest);
    });

    test("weight is uniform", () => {
      expect(new Set(items.map((item) => item.weight)).size).toBe(1);
    });
  });

  describe("when counts differ", () => {
    const items = buildWordCloud([
      { label: "molto", value: 10 },
      { label: "medio", value: 5 },
      { label: "poco", value: 1 },
    ]);
    const byLabel = Object.fromEntries(items.map((item) => [item.label, item]));

    test("a more frequent word is bigger", () => {
      expect(byLabel.molto.fontSize).toBeGreaterThan(byLabel.medio.fontSize);
      expect(byLabel.medio.fontSize).toBeGreaterThan(byLabel.poco.fontSize);
    });

    test("weights span the full range", () => {
      expect(byLabel.molto.weight).toBe(1);
      expect(byLabel.poco.weight).toBe(0);
    });
  });

  test("more words means smaller type", () => {
    const few = buildWordCloud(
      Array.from({ length: 5 }, (_, i) => ({ label: `w${i}`, value: 1 })),
    );
    const many = buildWordCloud(
      Array.from({ length: 24 }, (_, i) => ({ label: `w${i}`, value: 1 })),
    );
    expect(many[0].fontSize).toBeLessThan(few[0].fontSize);
  });

  test("caps the number of words shown", () => {
    const items = buildWordCloud(
      Array.from({ length: 100 }, (_, i) => ({ label: `w${i}`, value: i + 1 })),
    );
    expect(items.length).toBe(24);
  });

  test("keeps the most frequent words when capping", () => {
    const items = buildWordCloud(
      Array.from({ length: 50 }, (_, i) => ({ label: `w${i}`, value: i + 1 })),
    );
    // w49 is the most frequent and must survive; w0 is the least and must not.
    expect(items.some((item) => item.label === "w49")).toBe(true);
    expect(items.some((item) => item.label === "w0")).toBe(false);
  });

  test("the largest word is not first, so big words are not stacked together", () => {
    const items = buildWordCloud([
      { label: "grande", value: 10 },
      { label: "a", value: 4 },
      { label: "b", value: 3 },
      { label: "c", value: 2 },
      { label: "d", value: 1 },
    ]);
    const largestIndex = items.findIndex((item) => item.label === "grande");
    expect(largestIndex).toBeGreaterThan(0);
    expect(largestIndex).toBeLessThan(items.length - 1);
  });

  test("every word is kept exactly once when interleaving", () => {
    const labels = ["a", "b", "c", "d", "e", "f", "g"];
    const items = buildWordCloud(labels.map((label, i) => ({ label, value: i + 1 })));
    expect([...items.map((item) => item.label)].sort()).toEqual([...labels].sort());
  });

  test("font sizes stay within a sane range", () => {
    // Widest realistic spread and the maximum number of words, so nothing can
    // silently grow to a size that would overflow a 1080p overlay.
    for (const count of [3, 12, 24, 40]) {
      const items = buildWordCloud(
        Array.from({ length: count }, (_, i) => ({ label: `w${i}`, value: i + 1 })),
      );
      for (const item of items) {
        expect(item.fontSize).toBeGreaterThan(1);
        expect(item.fontSize).toBeLessThanOrEqual(6.2);
      }
    }
  });
});

describe("colorIndexFor", () => {
  test("is stable for the same word", () => {
    expect(colorIndexFor("assemblea")).toBe(colorIndexFor("assemblea"));
  });

  test("stays inside the palette", () => {
    for (const label of ["a", "parola", "un'altra", "città", "x".repeat(50)]) {
      const index = colorIndexFor(label, 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  // Colour used to come from render order, so it changed whenever a new answer
  // reordered the list.
  test("does not depend on position in the list", () => {
    const first = buildWordCloud([
      { label: "stabile", value: 1 },
      { label: "altra", value: 5 },
    ]).find((item) => item.label === "stabile");

    const second = buildWordCloud([
      { label: "nuova", value: 9 },
      { label: "stabile", value: 1 },
      { label: "altra", value: 5 },
    ]).find((item) => item.label === "stabile");

    expect(first!.colorIndex).toBe(second!.colorIndex);
  });
});
