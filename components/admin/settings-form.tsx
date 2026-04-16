"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { compactClassesInput, parseClassesInput, serializeClassesInput, type ClassEntry } from "@/lib/classes";

type Props = {
  initialClasses: string;
  initialAppName: string;
  initialAppIcon: string;
};

export function AdminSettingsForm({ initialClasses, initialAppName, initialAppIcon }: Props) {
  const [classesValue, setClassesValue] = useState(initialClasses);
  const [appName, setAppName] = useState(initialAppName);
  const [appIcon, setAppIcon] = useState(initialAppIcon);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveAll() {
    setSaving(true);
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
        // Auto-compact the classes input after saving
        setClassesValue(compactClassesInput(classesPayload.classes));
      }

      const allOk = brandRes.ok && classesRes.ok;
      setNote({ ok: allOk, text: allOk ? "Impostazioni salvate." : "Errore durante il salvataggio." });
    } catch {
      setNote({ ok: false, text: "Impossibile salvare le impostazioni." });
    } finally {
      setSaving(false);
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
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Classtreamer"
            />
            <p className="text-xs text-muted">Mostrato nell&apos;header e nei metadati.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appIcon">URL icona</Label>
            <Input
              id="appIcon"
              value={appIcon}
              onChange={(e) => setAppIcon(e.target.value)}
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
          onChange={(e) => setClassesValue(e.target.value)}
          rows={4}
          placeholder="1A-E, 2A-E, 3A-D, 3E, 4A-E, 5A-E, INSEGNANTI"
          className="font-mono text-sm"
        />
      </div>

      {/* ── Save button ── */}
      <div className="flex items-center gap-4 px-6 py-4">
        <Button onClick={saveAll} disabled={saving}>
          {saving ? "Salvataggio..." : "Salva impostazioni"}
        </Button>
        {note ? (
          <p className={`text-sm ${note.ok ? "text-success-foreground" : "text-destructive-foreground"}`}>
            {note.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
