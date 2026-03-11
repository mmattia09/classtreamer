export type ClassEntry = {
  year: number;
  section: string;
  displayName?: string | null;
};

const STAR_YEAR = 0;

export function getYearLabel(year: number) {
  return year === STAR_YEAR ? "*" : String(year);
}

export function parseClassesInput(input: string): ClassEntry[] {
  const entries = input
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const unique = new Map<string, ClassEntry>();

  for (const entry of entries) {
    const match = entry.match(/^([1-5])(.+)$/);
    if (match) {
      const year = Number(match[1]);
      const section = match[2].trim().toUpperCase();
      if (!section) {
        continue;
      }
      unique.set(`${year}-${section}`, { year, section, displayName: null });
      continue;
    }

    const section = entry.toUpperCase();
    if (!section) {
      continue;
    }
    unique.set(`${STAR_YEAR}-${section}`, { year: STAR_YEAR, section, displayName: null });
  }

  return Array.from(unique.values());
}

export function serializeClassesInput(classes: ClassEntry[]): string {
  const sorted = [...classes].sort((a, b) => {
    const yearA = a.year === STAR_YEAR ? 99 : a.year;
    const yearB = b.year === STAR_YEAR ? 99 : b.year;
    if (yearA !== yearB) {
      return yearA - yearB;
    }
    return a.section.localeCompare(b.section);
  });

  return sorted
    .map((entry) => (entry.year === STAR_YEAR ? entry.section : `${entry.year}${entry.section}`))
    .join(",");
}

export function groupClassesByYear(classes: ClassEntry[]) {
  const grouped = new Map<number, ClassEntry[]>();

  for (const entry of classes) {
    if (!grouped.has(entry.year)) {
      grouped.set(entry.year, []);
    }
    grouped.get(entry.year)!.push(entry);
  }

  for (const [year, entries] of grouped.entries()) {
    const sorted = [...entries].sort((a, b) => a.section.localeCompare(b.section));
    grouped.set(year, sorted);
  }

  return grouped;
}
