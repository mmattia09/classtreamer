import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SectionPickerProps = {
  year: number;
  sections: Array<{ section: string; displayName: string | null }>;
};

export function SectionPicker({ year, sections }: SectionPickerProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <Card className="w-full space-y-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Classe {year}</p>
          <h1 className="text-4xl font-semibold">Seleziona la sezione</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {sections.map((entry) => (
            <Button key={entry.section} asChild className="h-24 text-3xl">
              <Link href={`/class/${year}/${entry.section}`}>{entry.displayName ?? entry.section}</Link>
            </Button>
          ))}
        </div>
      </Card>
    </main>
  );
}
