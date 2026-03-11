import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAppConfig } from "@/lib/app-config";

export function RoleSelection() {
  const { name } = getAppConfig();

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-ocean/70">{name}</p>
          <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-tight text-ink md:text-7xl">
            La regia delle stream scolastiche, con classi e risposte in tempo reale.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-ink/70">
            Un&apos;interfaccia unica per portare la diretta in aula, attivare sondaggi,
            raccogliere domande e proiettare i risultati live.
          </p>
        </section>

        <Card className="grid gap-4 bg-gradient-to-br from-white via-white to-ocean/5 p-5">
          <Button asChild className="h-28 text-2xl">
            <Link href="/class">Sono una Classe</Link>
          </Button>
          <Button asChild variant="secondary" className="h-28 text-2xl">
            <Link href="/admin">Sono un Tecnico</Link>
          </Button>
        </Card>
      </div>
    </main>
  );
}
