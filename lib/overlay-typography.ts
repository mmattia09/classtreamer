/**
 * Type sizing for the OBS overlay.
 *
 * The overlay is read from the back of a room, on a projector, so everything is
 * sized in viewport units against a 1920x1080 canvas rather than in fixed rem.
 * The featured answer additionally has to shrink as it gets longer: a one-line
 * reply and a three-sentence one cannot share a font size without either
 * wasting most of the screen or running off it.
 */

/** Longest answer the overlay will show in full before clamping. */
export const FEATURED_MAX_CHARS = 320;

type SizeStep = {
  /** Applies while the text is no longer than this. */
  maxChars: number;
  /** Font size in vw. */
  vw: number;
};

// Tuned against a 1920px-wide canvas: 5.2vw ≈ 100px, 2.1vw ≈ 40px.
const FEATURED_STEPS: SizeStep[] = [
  { maxChars: 40, vw: 5.2 },
  { maxChars: 80, vw: 4.2 },
  { maxChars: 140, vw: 3.4 },
  { maxChars: 220, vw: 2.7 },
  { maxChars: Number.POSITIVE_INFINITY, vw: 2.1 },
];

/** Font size in vw for the highlighted answer, based on how long it is. */
export function featuredAnswerFontVw(text: string) {
  const length = text.trim().length;
  return (FEATURED_STEPS.find((step) => length <= step.maxChars) ?? FEATURED_STEPS.at(-1)!).vw;
}

/**
 * Font size in vw for the secondary answers.
 *
 * They were fixed at 16px, which is unreadable on a projector. Fewer of them,
 * larger, beats a dense grid nobody can read: the size shrinks as the count
 * grows so the column still fits.
 */
export function secondaryAnswerFontVw(count: number) {
  if (count <= 3) return 1.5;
  if (count <= 5) return 1.3;
  return 1.15;
}

/** Trim an over-long answer so it cannot overflow the screen. */
export function clampFeaturedText(text: string, maxChars = FEATURED_MAX_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  // Cut on a word boundary so the ellipsis does not land mid-word.
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
