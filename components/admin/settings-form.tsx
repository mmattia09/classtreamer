"use client";

import { Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compactClassesInput, type ClassEntry } from "@/lib/classes";
import { cn } from "@/lib/utils";

type Props = {
  initialClasses: string;
  initialAppName: string;
  initialAppIcon: string;
};

export function AdminSettingsForm({ initialClasses, initialAppName, initialAppIcon }: Props) {
  const [classesValue, setClassesValue] = useState(initialClasses);
  const [appName, setAppName] = useState(initialAppName);
  const [appIcon, setAppIcon] = useState(initialAppIcon);
  const [isDirty, setIsDirty] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [savePhase, setSavePhase] = useState<"idle" | "saving" | "exiting">("idle");
  const saveExitTimerRef = useRef<number | null>(null);
  const saving = savePhase === "saving";
  const saveAnimatingOut = savePhase === "exiting";
  const saveBusy = savePhase === "saving" || savePhase === "exiting";
  const saveVisible = isDirty || saveBusy;

  useEffect(() => {
    return () => {
      if (saveExitTimerRef.current !== null) {
        window.clearTimeout(saveExitTimerRef.current);
      }
    };
  }, []);

  function markDirty() { setIsDirty(true); setNote(null); }

  async function saveAll() {
    if (saveExitTimerRef.current !== null) {
      window.clearTimeout(saveExitTimerRef.current);
      saveExitTimerRef.current = null;
    }
    setSavePhase("saving");
    setNote(null);
    try {
      const [brandRes, classesRes] = await Promise.all([
        fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appName, appIcon }),
        }),
        fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classes: classesValue }),
        }),
      ]);

      const [brandPayload, classesPayload] = await Promise.all([
        brandRes.json() as Promise<{ ok?: boolean; settings?: { appName: string; appIcon: string } }>,
        classesRes.json() as Promise<{ ok?: boolean; classes?: ClassEntry[] }>,
      ]);

      if (brandPayload.ok && brandPayload.settings) {
        setAppName(brandPayload.settings.appName);
        setAppIcon(brandPayload.settings.appIcon);
      }
      if (classesPayload.ok && classesPayload.classes) {
        setClassesValue(compactClassesInput(classesPayload.classes));
      }

      const allOk = brandRes.ok && classesRes.ok;
      setNote({ ok: allOk, text: allOk ? "Impostazioni salvate." : "Errore durante il salvataggio." });
      if (allOk) {
        setIsDirty(false);
        setSavePhase("exiting");
        saveExitTimerRef.current = window.setTimeout(() => {
          setSavePhase("idle");
          saveExitTimerRef.current = null;
        }, 350);
        return;
      }
      setSavePhase("idle");
    } catch {
      setNote({ ok: false, text: "Impossibile salvare le impostazioni." });
      setSavePhase("idle");
    }
  }

  return (
    <div className="divide-y divide-border">
      {/* ── Branding ── */}
      <div className="p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Branding</h2>
          <p className="mt-0.5 text-sm text-muted">Nome e logo dell&apos;applicazione.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="appName">Nome app</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => { setAppName(e.target.value); markDirty(); }}
              placeholder="Classtreamer"
            />
            <p className="text-xs text-muted">Mostrato nell&apos;header e nei metadati.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appIcon">URL icona</Label>
            <Input
              id="appIcon"
              value={appIcon}
              onChange={(e) => { setAppIcon(e.target.value); markDirty(); }}
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted">Lascia vuoto per il logo predefinito.</p>
          </div>
        </div>

        {/* Logo preview */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center">
            {appIcon ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={appIcon}
                alt="Logo preview"
                className="h-12 w-12 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                onLoad={(e) => { (e.target as HTMLImageElement).style.display = ""; }}
              />
            ) : (
              <span className="text-2xl font-bold text-accent">
                {appName ? appName.slice(0, 1).toUpperCase() : "?"}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{appName || "—"}</p>
            <p className="text-xs text-muted">Anteprima in tempo reale</p>
          </div>
        </div>
      </div>

      {/* ── Classes ── */}
      <div className="p-6">
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">Classi abilitate</h2>
          <p className="mt-0.5 text-sm text-muted">
            Separale con virgola. Puoi usare la notazione a intervallo:{" "}
            <code className="rounded bg-surface-raised px-1 py-0.5 text-xs font-mono">
              1A-E, 2A-E, 3A-D, 3E, INSEGNANTI
            </code>
            . Il testo verrà compattato automaticamente al salvataggio.
          </p>
        </div>
        <Textarea
          value={classesValue}
          onChange={(e) => { setClassesValue(e.target.value); markDirty(); }}
          rows={4}
          placeholder="1A-E, 2A-E, 3A-D, 3E, 4A-E, 5A-E, INSEGNANTI"
          className="font-mono text-sm"
        />
      </div>

      {/* ── Floating save button — shown only when dirty ── */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 transition-all duration-300 ease-out ${
          saveAnimatingOut || !saveVisible ? "translate-y-16 opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        }`}
      >
        <div
          className={cn(
            "grid w-full max-w-xs transition-[grid-template-rows,opacity,transform] duration-250 ease-out",
            note ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 translate-y-1 pointer-events-none",
          )}
        >
          <div className="overflow-hidden">
            <div className={`rounded-lg px-3 py-2 text-sm text-white shadow-lg ${note?.ok ? "bg-success" : "bg-destructive"}`}>
              {note?.text ?? ""}
            </div>
          </div>
        </div>
        <Button onClick={saveAll} disabled={saveBusy} size="lg" className="gap-2 shadow-xl disabled:opacity-100">
          <Save className="h-4 w-4" />
          {saveBusy ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
