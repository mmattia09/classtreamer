export type WordCloudEntry = {
  label: string;
  value: number;
};

export type WordCloudItem = {
  label: string;
  value: number;
  /** 0…1 — how frequent this word is relative to the rest. */
  weight: number;
  /** Font size in vw units, ready to render. */
  fontSize: number;
  /** Palette index, derived from the label so it never changes. */
  colorIndex: number;
};

/**
 * Beyond this the long tail gets too small to read from the back of a
 * classroom. Showing fewer words larger beats showing every word illegibly.
 */
const MAX_WORDS = 24;

/** Font size range in vw, before the density adjustment. */
const MIN_FONT_VW = 2.3;
const MAX_FONT_VW = 6.2;

/**
 * Size used when every word has the same count. Above the midpoint on purpose:
 * with nothing to distinguish, the cloud should still fill the overlay rather
 * than sit as a small block in the middle of a 1080p canvas.
 */
const UNIFORM_WEIGHT = 0.62;

/**
 * Turn tallied words into a laid-out cloud.
 *
 * The previous implementation sized words as `sqrt(value / maxValue)`, which
 * collapses when every word appears once — the normal state of a word cloud
 * until someone repeats a word. Every ratio is then 1, so all 22 words rendered
 * at the maximum size and the "cloud" became a wall of identical text. Words
 * were also split into fixed rank bands (top 3, next 8, rest) whose boundaries
 * had nothing to do with the actual counts, and coloured by render order, so
 * colours reshuffled whenever a new answer changed the ordering.
 */
export function buildWordCloud(entries: WordCloudEntry[]): WordCloudItem[] {
  const ranked = [...entries]
    .filter((entry) => entry.label.trim().length > 0 && entry.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, MAX_WORDS);

  if (ranked.length === 0) {
    return [];
  }

  const values = ranked.map((entry) => entry.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  // More words on screen means each one has to be smaller to fit.
  const density = ranked.length <= 8 ? 1 : Math.max(0.62, 1 - (ranked.length - 8) * 0.02);

  const sized = ranked.map((entry) => {
    // All counts equal: no word is more important than another, so they share
    // one size rather than all being blown up to the maximum.
    const weight =
      maxValue === minValue
        ? UNIFORM_WEIGHT
        : // sqrt so the growth tracks perceived area rather than height.
          Math.sqrt((entry.value - minValue) / (maxValue - minValue));

    const fontSize = (MIN_FONT_VW + weight * (MAX_FONT_VW - MIN_FONT_VW)) * density;

    return {
      label: entry.label,
      value: entry.value,
      weight,
      fontSize: Math.round(fontSize * 100) / 100,
      colorIndex: colorIndexFor(entry.label),
    };
  });

  return interleaveBySize(sized);
}

/**
 * Stable colour per word: the same word always gets the same colour, whatever
 * its rank or when it arrived.
 */
export function colorIndexFor(label: string, paletteSize = 6) {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % paletteSize;
}

/**
 * Reorder so the largest words sit near the middle and sizes alternate outward,
 * which reads as a cloud. Straight descending order stacks every big word at
 * the top and leaves rows of uniform size below.
 */
function interleaveBySize<T>(items: T[]): T[] {
  const result: T[] = [];
  items.forEach((item, index) => {
    if (index % 2 === 0) {
      result.push(item);
    } else {
      result.unshift(item);
    }
  });
  return result;
}
