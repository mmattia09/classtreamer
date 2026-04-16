export type ClassEntry = {
  year: number;
  section: string;
  displayName?: string | null;
};

const STAR_YEAR = 0;

export function getYearLabel(year: number) {
  return year === STAR_YEAR ? "*" : String(year);
}

/**
 * Parse class input supporting range notation.
 * Examples:
 *   "1A-E"        → year=1, sections A B C D E
 *   "3A-D,3E"     → year=3, sections A B C D E
 *   "INSEGNANTI"  → year=0, section=INSEGNANTI
 *   "2A, 2B"      → year=2, sections A B
 */
export function parseClassesInput(input: string): ClassEntry[] {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const unique = new Map<string, ClassEntry>();

  for (const token of tokens) {
    // Range: 1A-E or 1A-E (year + start letter + dash + end letter)
    const rangeMatch = token.match(/^([1-5])([A-Za-z])-([A-Za-z])$/);
    if (rangeMatch) {
      const year = Number(rangeMatch[1]);
      const startCode = rangeMatch[2].toUpperCase().charCodeAt(0);
      const endCode = rangeMatch[3].toUpperCase().charCodeAt(0);
      const lo = Math.min(startCode, endCode);
      const hi = Math.max(startCode, endCode);
      for (let c = lo; c <= hi; c++) {
        const section = String.fromCharCode(c);
        unique.set(`${year}-${section}`, { year, section, displayName: null });
      }
      continue;
    }

    // Single numbered class: 1A, 2IA, etc.
    const singleMatch = token.match(/^([1-5])(.+)$/);
    if (singleMatch) {
      const year = Number(singleMatch[1]);
      const section = singleMatch[2].trim().toUpperCase();
      if (section) unique.set(`${year}-${section}`, { year, section, displayName: null });
      continue;
    }

    // Special class (no leading digit): INSEGNANTI, etc.
    const section = token.toUpperCase();
    if (section) unique.set(`${STAR_YEAR}-${section}`, { year: STAR_YEAR, section, displayName: null });
  }

  return Array.from(unique.values());
}

/**
 * Serialize ClassEntry[] back to a compact string, using range notation
 * where sections are consecutive single letters (≥2 in sequence).
 * Example: [{year:1,section:'A'}, {year:1,section:'B'}, {year:1,section:'C'}]
 *          → "1A-C"
 */
export function serializeClassesInput(classes: ClassEntry[]): string {
  return compactClassesInput(classes);
}

export function compactClassesInput(classes: ClassEntry[]): string {
  // Sort: year asc (star year last), section asc
  const sorted = [...classes].sort((a, b) => {
    const ya = a.year === STAR_YEAR ? 99 : a.year;
    const yb = b.year === STAR_YEAR ? 99 : b.year;
    if (ya !== yb) return ya - yb;
    return a.section.localeCompare(b.section);
  });

  // Group by year
  const byYear = new Map<number, string[]>();
  for (const { year, section } of sorted) {
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(section);
  }

  const parts: string[] = [];

  for (const [year, sections] of byYear) {
    if (year === STAR_YEAR) {
      // Special classes: output as-is
      parts.push(...sections);
      continue;
    }

    // Split into single-letter sections (compactable) and multi-char (not)
    const letters = sections.filter((s) => s.length === 1 && /^[A-Z]$/.test(s));
    const others = sections.filter((s) => !(s.length === 1 && /^[A-Z]$/.test(s)));

    // Compact consecutive letter runs into ranges
    let i = 0;
    while (i < letters.length) {
      let j = i;
      while (
        j + 1 < letters.length &&
        letters[j + 1].charCodeAt(0) === letters[j].charCodeAt(0) + 1
      ) {
        j++;
      }
      const runLen = j - i + 1;
      if (runLen >= 2) {
        parts.push(`${year}${letters[i]}-${letters[j]}`);
      } else {
        parts.push(`${year}${letters[i]}`);
      }
      i = j + 1;
    }

    for (const s of others) {
      parts.push(`${year}${s}`);
    }
  }

  return parts.join(", ");
}

export function groupClassesByYear(classes: ClassEntry[]) {
  const grouped = new Map<number, ClassEntry[]>();

  for (const entry of classes) {
    if (!grouped.has(entry.year)) grouped.set(entry.year, []);
    grouped.get(entry.year)!.push(entry);
  }

  for (const [year, entries] of grouped.entries()) {
    grouped.set(year, [...entries].sort((a, b) => a.section.localeCompare(b.section)));
  }

  return grouped;
}
