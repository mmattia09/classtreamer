"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { serializeClassesInput, type ClassEntry } from "@/lib/classes";

type Props = {
  initialClasses: string;
  initialAppName: string;
  initialAppIcon: string;
  initialAppBgColor: string;
  initialAppMainColor: string;
  initialAppLightColor: string;
};

export function AdminSettingsForm({
  initialClasses,
  initialAppName,
  initialAppIcon,
  initialAppBgColor,
  initialAppMainColor,
  initialAppLightColor,
}: Props) {
  const [classesValue, setClassesValue] = useState(initialClasses);
  const [appName, setAppName] = useState(initialAppName);
  const [appIcon, setAppIcon] = useState(initialAppIcon);
  const [appBgColor, setAppBgColor] = useState(initialAppBgColor);
  const [appMainColor, setAppMainColor] = useState(initialAppMainColor);
  const [appLightColor, setAppLightColor] = useState(initialAppLightColor);
  const [savingClasses, setSavingClasses] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [classesNote, setClassesNote] = useState<string | null>(null);
  const [brandNote, setBrandNote] = useState<string | null>(null);

  async function saveClasses() {
    setSavingClasses(true);
    setClassesNote(null);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes: classesValue }),
      });
      const payload = (await response.json()) as { ok?: boolean; classes?: ClassEntry[] };
      if (payload.ok && payload.classes) {
        setClassesValue(serializeClassesInput(payload.classes));
        setClassesNote("Classi aggiornate.");
      } else {
        setClassesNote("Non riesco ad aggiornare le classi.");
      }
    } catch {
      setClassesNote("Non riesco ad aggiornare le classi.");
    } finally {
      setSavingClasses(false);
    }
  }

  async function saveBranding() {
    setSavingBrand(true);
    setBrandNote(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          appIcon,
          appBgColor,
          appMainColor,
          appLightColor,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean };
      setBrandNote(payload.ok ? "Tema aggiornato." : "Non riesco ad aggiornare il tema.");
    } catch {
      setBrandNote("Non riesco ad aggiornare il tema.");
    } finally {
      setSavingBrand(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Tema e branding</h2>
          <p className="text-sm text-ink/65">
            Modifica il nome dell&apos;app, la favicon e i colori principali.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-semibold">Nome app</div>
            <p className="text-xs text-ink/60">Titolo mostrato in home, header e metadata.</p>
            <input
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
              placeholder="Nome app"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Icona</div>
            <p className="text-xs text-ink/60">URL dell&apos;immagine usata come favicon e logo.</p>
            <input
              value={appIcon}
              onChange={(event) => setAppIcon(event.target.value)}
              className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
              placeholder="URL icona"
            />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Colore sfondo</div>
            <p className="text-xs text-ink/60">Usato per il background principale.</p>
            <div className="flex items-center gap-3">
              <input
                value={appBgColor}
                onChange={(event) => setAppBgColor(event.target.value)}
                className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                placeholder="#f8f9fa"
              />
              <input
                type="color"
                value={appBgColor}
                onChange={(event) => setAppBgColor(event.target.value)}
                className="h-12 w-16 rounded-xl border border-ocean/10 bg-white p-1"
                aria-label="Selettore colore sfondo"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Colore principale</div>
            <p className="text-xs text-ink/60">Colore per bottoni, testi chiave e accenti.</p>
            <div className="flex items-center gap-3">
              <input
                value={appMainColor}
                onChange={(event) => setAppMainColor(event.target.value)}
                className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                placeholder="#002d61"
              />
              <input
                type="color"
                value={appMainColor}
                onChange={(event) => setAppMainColor(event.target.value)}
                className="h-12 w-16 rounded-xl border border-ocean/10 bg-white p-1"
                aria-label="Selettore colore principale"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold">Colore secondario</div>
            <p className="text-xs text-ink/60">Colore per evidenze leggere e dettagli.</p>
            <div className="flex items-center gap-3">
              <input
                value={appLightColor}
                onChange={(event) => setAppLightColor(event.target.value)}
                className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                placeholder="#003f87"
              />
              <input
                type="color"
                value={appLightColor}
                onChange={(event) => setAppLightColor(event.target.value)}
                className="h-12 w-16 rounded-xl border border-ocean/10 bg-white p-1"
                aria-label="Selettore colore secondario"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={saveBranding} disabled={savingBrand}>
            {savingBrand ? "Salvataggio..." : "Salva tema"}
          </Button>
          {brandNote ? <span className="text-sm text-ink/70">{brandNote}</span> : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Classi abilitate</h2>
          <p className="text-sm text-ink/65">
            Inserisci le classi separate da virgola. Gli spazi sono ammessi dopo la virgola.
          </p>
          <p className="text-sm text-ink/60">
            Le classi senza numero iniziale finiscono nell&apos;anno &quot;*&quot;.
          </p>
        </div>
        <textarea
          value={classesValue}
          onChange={(event) => setClassesValue(event.target.value)}
          rows={4}
          className="w-full rounded-2xl border border-ocean/10 bg-white px-4 py-3 text-base outline-none ring-ocean/20 focus:ring-4"
          placeholder="1A,1B,1C,2A,2B,3IA,3B,4A-IM,4Z,5AAA,5BBB,INSEGNANTI"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={saveClasses} disabled={savingClasses}>
            {savingClasses ? "Salvataggio..." : "Salva classi"}
          </Button>
          {classesNote ? <span className="text-sm text-ink/70">{classesNote}</span> : null}
        </div>
      </section>
    </div>
  );
}
