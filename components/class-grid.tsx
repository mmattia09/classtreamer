import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ClassGrid() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-10">
      <Card className="w-full space-y-8">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Classe</p>
          <h1 className="text-4xl font-semibold">Seleziona l&apos;anno</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((year) => (
            <Button key={year} asChild className="h-24 text-4xl">
              <Link href={`/class/${year}`}>{year}</Link>
            </Button>
          ))}
        </div>
      </Card>
    </main>
  );
}
