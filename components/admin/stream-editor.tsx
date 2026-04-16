"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getYearLabel } from "@/lib/classes";

type EditableClass = { id: string; year: number; section: string; displayName: string | null };
type EditableQuestion = {
  id: string;
  text: string;
  inputType: string;
  audienceType: string;
  timerSeconds: number | null;
  options: string[];
  settings?: Record<string, number>;
  status: string;
  resultsVisible: boolean;
};

const STREAM_STATUS_VARIANTS: Record<string, "live" | "warning" | "secondary"> = {
  DRAFT: "secondary",
  SCHEDULED: "warning",
  LIVE: "live",
  ENDED: "secondary",
};

const STREAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bozza",
  SCHEDULED: "Programmata",
  LIVE: "Live",
  ENDED: "Conclusa",
};

const QUESTION_STATUS_VARIANTS: Record<string, "live" | "default" | "secondary"> = {
  LIVE: "live",
  RESULTS: "default",
  DRAFT: "secondary",
  CLOSED: "secondary",
};

const QUESTION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bozza",
  LIVE: "In corso",
  RESULTS: "Risultati",
  CLOSED: "Chiusa",
};

const INPUT_LABELS: Record<string, string> = {
  OPEN: "Aperta",
  WORD_COUNT: "Word cloud",
  SCALE: "Scala",
  SINGLE_CHOICE: "Scelta singola",
  MULTIPLE_CHOICE: "Scelta multipla",
};

export function StreamEditor({
  stream,
  classes,
}: {
  stream?: {
    id: string;
    title: string;
    embedUrl: string;
    scheduledAt: string;
    status: string;
    targetClassIds: string[];
    questions: EditableQuestion[];
  };
  classes: EditableClass[];
}) {
  const router = useRouter();
  const questionsEndRef = useRef<HTMLDivElement>(null);

  const [payload, setPayload] = useState(
    stream ?? {
      title: "",
      embedUrl: "",
      scheduledAt: "",
      status: "DRAFT",
      targetClassIds: [] as string[],
      questions: [] as EditableQuestion[],
    },
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [invalidQuestions, setInvalidQuestions] = useState<Set<number>>(new Set());

  async function save() {
    if (!payload.title.trim()) {
      setSaveError("Il titolo è obbligatorio.");
      return;
    }

    const emptyIndexes = new Set<number>();
    payload.questions.forEach((q, i) => {
      if (!q.text.trim()) emptyIndexes.add(i);
    });
    if (emptyIndexes.size > 0) {
      setInvalidQuestions(emptyIndexes);
      setSaveError(
        emptyIndexes.size === 1
          ? "Una domanda è priva di testo."
          : `${emptyIndexes.size} domande sono prive di testo.`,
      );
      return;
    }

    setInvalidQuestions(new Set());
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(stream ? `/api/streams/${stream.id}` : "/api/streams", {
        method: stream ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        setSaveError(`Errore nel salvataggio: ${text || response.statusText}`);
        return;
      }

      const data = await response.json();
      if (!stream) {
        router.push(`/admin/streams/${data.id}`);
      } else {
        setSaveSuccess(true);
        router.refresh();
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      setSaveError("Errore di rete. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  function addQuestion() {
    setPayload((cur) => ({
      ...cur,
      questions: [
        ...cur.questions,
        {
          id: `draft-${Date.now()}`,
          text: "",
          inputType: "OPEN",
          audienceType: "CLASS",
          timerSeconds: 60,
          options: [],
          settings: {},
          status: "DRAFT",
          resultsVisible: false,
        },
      ],
    }));
    setTimeout(() => {
      questionsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 50);
  }

  function removeQuestion(index: number) {
    setPayload((cur) => ({ ...cur, questions: cur.questions.filter((_, i) => i !== index) }));
    setInvalidQuestions((current) => {
      const updated = new Set<number>();
      current.forEach((i) => {
        if (i < index) updated.add(i);
        else if (i > index) updated.add(i - 1);
      });
      return updated;
    });
  }

  function moveQuestion(index: number, direction: "up" | "down") {
    setPayload((cur) => {
      const updated = [...cur.questions];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= updated.length) return cur;
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return { ...cur, questions: updated };
    });
  }

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    setPayload((cur) => ({
      ...cur,
      questions: cur.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
    if (patch.text !== undefined && patch.text.trim()) {
      setInvalidQuestions((current) => {
        const updated = new Set(current);
        updated.delete(index);
        return updated;
      });
    }
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const options = [...payload.questions[questionIndex].options];
    options[optionIndex] = value;
    updateQuestion(questionIndex, { options });
  }

  function addOption(questionIndex: number) {
    updateQuestion(questionIndex, { options: [...payload.questions[questionIndex].options, ""] });
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    updateQuestion(questionIndex, {
      options: payload.questions[questionIndex].options.filter((_, i) => i !== optionIndex),
    });
  }

  return (
    <div className="space-y-4">
      {/* Top row: preview + settings */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Preview */}
        <Card className="overflow-hidden p-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Anteprima stream</CardTitle>
              <Badge variant={STREAM_STATUS_VARIANTS[payload.status] ?? "secondary"}>
                {STREAM_STATUS_LABELS[payload.status] ?? payload.status}
              </Badge>
            </div>
          </CardHeader>
          <div className="bg-zinc-950 aspect-video">
            {payload.embedUrl ? (
              <iframe src={payload.embedUrl} className="h-full w-full" allow="fullscreen; autoplay" />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
                Inserisci un URL embed per vedere l&apos;anteprima
              </div>
            )}
          </div>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Impostazioni</CardTitle>
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? "Salvataggio..." : saveSuccess ? "Salvato ✓" : "Salva"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {saveError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {saveError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Titolo</Label>
              <Input
                value={payload.title}
                onChange={(e) => setPayload((p) => ({ ...p, title: e.target.value }))}
                placeholder="Titolo della stream"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL embed</Label>
              <Input
                value={payload.embedUrl}
                onChange={(e) => setPayload((p) => ({ ...p, embedUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data programmata</Label>
              <Input
                type="datetime-local"
                value={payload.scheduledAt}
                onChange={(e) => setPayload((p) => ({ ...p, scheduledAt: e.target.value }))}
              />
            </div>
            <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-muted">
              {payload.targetClassIds.length
                ? `${payload.targetClassIds.length} ${payload.targetClassIds.length === 1 ? "classe selezionata" : "classi selezionate"}`
                : "Visibile a tutte le classi"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: questions + classes */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Questions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Domande preparate</CardTitle>
              <Button size="sm" variant="secondary" onClick={addQuestion}>
                + Aggiungi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {payload.questions.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">Nessuna domanda aggiunta.</p>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="mt-1 text-sm font-medium text-accent hover:underline"
                >
                  Aggiungi la prima domanda →
                </button>
              </div>
            )}

            {payload.questions.map((q, idx) => {
              const hasError = invalidQuestions.has(idx);
              return (
                <div
                  key={q.id}
                  className={`rounded-lg border p-3 space-y-3 ${
                    hasError ? "border-destructive/40 bg-destructive/5" : "border-border"
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted">#{idx + 1}</span>
                      <Badge variant={QUESTION_STATUS_VARIANTS[q.status] ?? "secondary"}>
                        {QUESTION_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, "up")}
                        disabled={idx === 0}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted transition hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        title="Sposta su"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(idx, "down")}
                        disabled={idx === payload.questions.length - 1}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted transition hover:bg-surface-raised hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                        title="Sposta giù"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        className="text-xs text-muted hover:text-destructive transition-colors ml-1"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>

                  {/* Question text */}
                  <Input
                    value={q.text}
                    onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                    placeholder={hasError ? "Il testo è obbligatorio" : "Testo della domanda"}
                    className={hasError ? "border-destructive/50 bg-destructive/5 placeholder:text-destructive/60" : ""}
                  />

                  {/* Type / Audience / Timer */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted">Tipo</Label>
                      <Select
                        value={q.inputType}
                        onChange={(e) => updateQuestion(idx, { inputType: e.target.value, options: [] })}
                      >
                        {Object.entries(INPUT_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted">Audience</Label>
                      <Select
                        value={q.audienceType}
                        onChange={(e) => updateQuestion(idx, { audienceType: e.target.value })}
                      >
                        <option value="CLASS">Classe</option>
                        <option value="INDIVIDUAL">Individuale</option>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted">Timer</Label>
                      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={q.timerSeconds !== null}
                          onChange={(e) => updateQuestion(idx, { timerSeconds: e.target.checked ? 60 : null })}
                          className="accent-accent"
                        />
                        {q.timerSeconds !== null ? "Attivo" : "Disabilitato"}
                      </label>
                      {q.timerSeconds !== null && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            value={q.timerSeconds}
                            onChange={(e) => updateQuestion(idx, { timerSeconds: Math.max(1, +e.target.value) })}
                            min={1}
                          />
                          <span className="shrink-0 text-xs text-muted">s</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Options (choice types) */}
                  {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.inputType) && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted">Opzioni</Label>
                      {q.options.map((option, optIdx) => (
                        <div key={optIdx} className="flex gap-2">
                          <Input
                            value={option}
                            onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                            placeholder={`Opzione ${optIdx + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeOption(idx, optIdx)}
                            className="shrink-0 text-xs text-muted hover:text-destructive transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(idx)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        + Aggiungi opzione
                      </button>
                    </div>
                  )}

                  {/* Scale settings */}
                  {q.inputType === "SCALE" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted">Scala</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          value={q.settings?.min ?? 1}
                          onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, min: +e.target.value } })}
                          placeholder="Min"
                        />
                        <Input
                          type="number"
                          value={q.settings?.max ?? 10}
                          onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, max: +e.target.value } })}
                          placeholder="Max"
                        />
                        <Input
                          type="number"
                          value={q.settings?.step ?? 1}
                          onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, step: +e.target.value } })}
                          placeholder="Step"
                        />
                      </div>
                    </div>
                  )}

                  {/* Word cloud settings */}
                  {q.inputType === "WORD_COUNT" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted">Parole massime</Label>
                      <Input
                        type="number"
                        value={q.settings?.maxWords ?? 3}
                        onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, maxWords: +e.target.value } })}
                        min={1}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={questionsEndRef} />
          </CardContent>
        </Card>

        {/* Classes */}
        <Card>
          <CardHeader>
            <CardTitle>Classi target</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted">Lascia tutto deselezionato per renderla visibile a tutti.</p>
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {classes.map((cls) => {
                const checked = payload.targetClassIds.includes(cls.id);
                return (
                  <label
                    key={cls.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setPayload((p) => ({
                          ...p,
                          targetClassIds: e.target.checked
                            ? [...p.targetClassIds, cls.id]
                            : p.targetClassIds.filter((id) => id !== cls.id),
                        }))
                      }
                      className="h-3.5 w-3.5 rounded accent-accent"
                    />
                    <span className="text-sm text-foreground">
                      {cls.displayName ?? `${getYearLabel(cls.year)}${cls.section}`}
                    </span>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
