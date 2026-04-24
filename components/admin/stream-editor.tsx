"use client";

import {
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Hash,
  Infinity,
  Link2,
  List,
  MessageSquare,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getYearLabel } from "@/lib/classes";
import { cn } from "@/lib/utils";

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
type PendingFocus =
  | { type: "option"; qIdx: number; optIdx: number }
  | { type: "question"; qIdx: number };

const STREAM_STATUS_VARIANTS: Record<string, "live" | "warning" | "secondary"> = {
  DRAFT: "secondary", SCHEDULED: "warning", LIVE: "live", ENDED: "secondary",
};
const STREAM_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Bozza", SCHEDULED: "Programmata", LIVE: "Live", ENDED: "Conclusa",
};
const QUESTION_STATUS_VARIANTS: Record<string, "live" | "default" | "secondary"> = {
  LIVE: "live", RESULTS: "default", DRAFT: "secondary", CLOSED: "secondary",
};
const QUESTION_STATUS_LABELS: Record<string, string> = {
  LIVE: "In corso", RESULTS: "Risultati", CLOSED: "Chiusa",
};
const INPUT_LABELS: Record<string, string> = {
  OPEN: "Aperta", WORD_COUNT: "Word cloud", SCALE: "Scala",
  SINGLE_CHOICE: "Scelta singola", MULTIPLE_CHOICE: "Scelta multipla",
};
const TIMER_PRESETS: { label: string; value: number | null }[] = [
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
  { label: "∞", value: null },
];
const PRESET_VALUES = new Set(TIMER_PRESETS.map((p) => p.value));
const QUESTION_FIELD_FOCUS =
  "focus-visible:border-accent/70 focus-visible:ring-1 focus-visible:ring-accent/45 focus-visible:ring-offset-0";

/** Convert a UTC ISO string to a local datetime-local input value (YYYY-MM-DDTHH:mm) */
function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function toEditorPayload(stream: {
  id: string;
  title: string;
  embedUrl: string;
  scheduledAt: string;
  status: string;
  targetClassIds: string[];
  questions: EditableQuestion[];
}) {
  return {
    ...stream,
    scheduledAt: isoToLocalInput(stream.scheduledAt),
  };
}

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
  const dragIndexRef = useRef<number | null>(null);
  const pendingFocusRef = useRef<PendingFocus | null>(null);
  const saveExitTimerRef = useRef<number | null>(null);

  const allClassIds = useMemo(() => classes.map((c) => c.id), [classes]);

  const [payload, setPayload] = useState(() => {
    if (stream) {
      return toEditorPayload(stream);
    }
    return {
      title: "",
      embedUrl: "",
      scheduledAt: "",
      status: "DRAFT",
      targetClassIds: allClassIds,
      questions: [] as EditableQuestion[],
    };
  });

  const [isDirty, setIsDirty] = useState(false);
  const [savePhase, setSavePhase] = useState<"idle" | "saving" | "exiting">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [invalidQuestions, setInvalidQuestions] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const saving = savePhase === "saving";
  const saveAnimatingOut = savePhase === "exiting";
  const saveBusy = savePhase === "saving" || savePhase === "exiting";
  const saveVisible = isDirty || saveBusy;

  /** Focus pending element after payload.questions re-render */
  useEffect(() => {
    const pf = pendingFocusRef.current;
    if (!pf) return;
    pendingFocusRef.current = null;
    const selector =
      pf.type === "option"
        ? `[data-option="${pf.qIdx}-${pf.optIdx}"]`
        : `[data-question-text="${pf.qIdx}"]`;
    (document.querySelector<HTMLInputElement>(selector))?.focus();
  }, [payload.questions]);

  useEffect(() => {
    return () => {
      if (saveExitTimerRef.current !== null) {
        window.clearTimeout(saveExitTimerRef.current);
      }
    };
  }, []);

  function update(updater: (prev: typeof payload) => typeof payload) {
    setIsDirty(true);
    setPayload(updater);
  }

  /* ── Year group selectors ── */
  const uniqueYears = useMemo(
    () => [...new Set(classes.map((c) => c.year))].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b)),
    [classes],
  );
  function getClassesForYear(year: number) {
    return classes.filter((c) => c.year === year).map((c) => c.id);
  }
  function yearSelectionState(year: number): "all" | "none" | "partial" {
    const ids = getClassesForYear(year);
    const selected = ids.filter((id) => payload.targetClassIds.includes(id));
    if (selected.length === 0) return "none";
    if (selected.length === ids.length) return "all";
    return "partial";
  }
  function toggleYear(year: number) {
    const ids = getClassesForYear(year);
    const state = yearSelectionState(year);
    update((p) => ({
      ...p,
      targetClassIds:
        state === "all"
          ? p.targetClassIds.filter((id) => !ids.includes(id))
          : [...new Set([...p.targetClassIds, ...ids])],
    }));
  }

  /* ── Save ── */
  async function save() {
    if (!payload.title.trim()) { setSaveError("Il titolo è obbligatorio."); return; }
    const emptyIndexes = new Set<number>();
    payload.questions.forEach((q, i) => { if (!q.text.trim()) emptyIndexes.add(i); });
    if (emptyIndexes.size > 0) {
      setInvalidQuestions(emptyIndexes);
      setSaveError(emptyIndexes.size === 1 ? "Una domanda è priva di testo." : `${emptyIndexes.size} domande sono prive di testo.`);
      return;
    }
    setInvalidQuestions(new Set());
    if (saveExitTimerRef.current !== null) {
      window.clearTimeout(saveExitTimerRef.current);
      saveExitTimerRef.current = null;
    }
    setSavePhase("saving");
    setSaveError(null);
    try {
      const body = {
        ...payload,
        scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt).toISOString() : null,
      };
      const response = await fetch(stream ? `/api/streams/${stream.id}` : "/api/streams", {
        method: stream ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        setSaveError(`Errore nel salvataggio: ${text || response.statusText}`);
        setSavePhase("idle");
        return;
      }
      const data = await response.json() as {
        id: string;
        stream?: {
          id: string;
          title: string;
          embedUrl: string;
          scheduledAt: string;
          status: string;
          targetClassIds: string[];
          questions: EditableQuestion[];
        };
      };
      if (!stream) {
        router.push(`/admin/streams/${data.id}`);
      } else {
        setIsDirty(false);
        if (data.stream) {
          setPayload(toEditorPayload(data.stream));
        }
        setSavePhase("exiting");
        saveExitTimerRef.current = window.setTimeout(() => {
          setSavePhase("idle");
          saveExitTimerRef.current = null;
          router.refresh();
        }, 350);
      }
    } catch {
      setSaveError("Errore di rete. Riprova.");
      setSavePhase("idle");
    }
  }

  /* ── Questions ── */
  function addQuestion() {
    pendingFocusRef.current = { type: "question", qIdx: payload.questions.length };
    update((cur) => ({
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
    setTimeout(() => questionsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
  }

  function removeQuestion(index: number) {
    update((cur) => ({ ...cur, questions: cur.questions.filter((_, i) => i !== index) }));
    setInvalidQuestions((current) => {
      const updated = new Set<number>();
      current.forEach((i) => { if (i < index) updated.add(i); else if (i > index) updated.add(i - 1); });
      return updated;
    });
  }

  function updateQuestion(index: number, patch: Partial<EditableQuestion>) {
    update((cur) => ({ ...cur, questions: cur.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }));
    if (patch.text !== undefined && patch.text.trim()) {
      setInvalidQuestions((current) => { const s = new Set(current); s.delete(index); return s; });
    }
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    const options = [...payload.questions[questionIndex].options];
    options[optionIndex] = value;
    updateQuestion(questionIndex, { options });
  }
  function addOption(questionIndex: number) {
    pendingFocusRef.current = {
      type: "option",
      qIdx: questionIndex,
      optIdx: payload.questions[questionIndex].options.length,
    };
    updateQuestion(questionIndex, { options: [...payload.questions[questionIndex].options, ""] });
  }
  function removeOption(questionIndex: number, optionIndex: number) {
    updateQuestion(questionIndex, { options: payload.questions[questionIndex].options.filter((_, i) => i !== optionIndex) });
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  /* ── Drag and drop ── */
  function handleDragStart(idx: number) { dragIndexRef.current = idx; }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setInsertAt(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1);
  }
  function handleDrop() {
    const from = dragIndexRef.current;
    if (from === null || insertAt === null) { cleanup(); return; }
    const target = insertAt > from ? insertAt - 1 : insertAt;
    if (from !== target) {
      update((cur) => {
        const updated = [...cur.questions];
        const [moved] = updated.splice(from, 1);
        updated.splice(target, 0, moved);
        return { ...cur, questions: updated };
      });
    }
    cleanup();
  }
  function cleanup() { dragIndexRef.current = null; setInsertAt(null); }

  const InsertLine = () => <div className="mx-1 h-0.5 rounded-full bg-accent" />;

  return (
    <div className="space-y-4">
      {/* ── 3-column grid: Preview | Settings | Classes ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)_minmax(10.8rem,14.4rem)]">

        {/* 1. Preview — no header, no badge, iframe fills card */}
        <Card className="overflow-hidden p-0">
          <div className="relative bg-zinc-950 min-h-[200px] h-full">
            {payload.embedUrl ? (
              <iframe src={payload.embedUrl} className="absolute inset-0 h-full w-full" allow="fullscreen; autoplay" />
            ) : (
              <div className="flex min-h-[200px] items-center justify-center text-zinc-500 text-sm px-4 text-center">
                Inserisci un URL embed per vedere l&apos;anteprima
              </div>
            )}
          </div>
        </Card>

        {/* 2. Settings */}
        <Card>
          <CardHeader><CardTitle>Impostazioni</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Titolo</Label>
              <div className="relative">
                <Type className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input value={payload.title}
                  onChange={(e) => update((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Titolo della stream" className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>URL embed</Label>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input value={payload.embedUrl}
                  onChange={(e) => update((p) => ({ ...p, embedUrl: e.target.value }))}
                  placeholder="https://..." className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Data programmata</Label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <Input type="datetime-local" value={payload.scheduledAt}
                  onChange={(e) => update((p) => ({ ...p, scheduledAt: e.target.value }))}
                  className="pl-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Classes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Classi target</CardTitle>
              <span className="text-xs text-muted tabular-nums">
                {payload.targetClassIds.length === allClassIds.length
                  ? "Tutte"
                  : `${payload.targetClassIds.length}/${allClassIds.length}`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button type="button"
                onClick={() => update((p) => ({ ...p, targetClassIds: allClassIds }))}
                className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:bg-surface-raised transition-colors">
                Tutte
              </button>
              <button type="button"
                onClick={() => update((p) => ({ ...p, targetClassIds: [] }))}
                className="text-xs px-2.5 py-1 rounded-md border border-border text-muted hover:bg-surface-raised transition-colors">
                Nessuna
              </button>
              {uniqueYears.map((year) => {
                const state = yearSelectionState(year);
                return (
                  <button key={year} type="button" onClick={() => toggleYear(year)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      state === "all" ? "bg-accent text-accent-foreground"
                        : state === "partial" ? "bg-accent-subtle text-accent border border-accent/30"
                        : "border border-border text-muted hover:bg-surface-raised"
                    }`}>
                    {year === 0 ? "Altro" : `${year}e`}
                  </button>
                );
              })}
            </div>
            <div className="max-h-[250px] space-y-0.5 overflow-y-auto pr-1">
              {classes.map((cls) => {
                const checked = payload.targetClassIds.includes(cls.id);
                return (
                  <label key={cls.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-raised">
                    <input type="checkbox" checked={checked}
                      onChange={(e) =>
                        update((p) => ({
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

      {/* ── Questions section (hidden for ENDED) ── */}
      {payload.status !== "ENDED" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Domande preparate</CardTitle>
              <Button size="sm" variant="secondary" onClick={addQuestion}>
                <Plus className="h-3.5 w-3.5" /> Aggiungi
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1" onDragLeave={() => setInsertAt(null)}>
            {payload.questions.length === 0 && (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted/40" />
                <p className="text-sm text-muted">Nessuna domanda aggiunta.</p>
                <button type="button" onClick={addQuestion}
                  className="mt-1.5 text-sm font-medium text-accent hover:underline">
                  Aggiungi la prima domanda →
                </button>
              </div>
            )}

            {payload.questions.map((q, idx) => {
              const hasError = invalidQuestions.has(idx);
              const isCollapsed = collapsed.has(q.id);
              const isNonDraft = q.status !== "DRAFT";
              const isCustomTimer = q.timerSeconds !== null && !PRESET_VALUES.has(q.timerSeconds);

              return (
                <div key={q.id}>
                  {insertAt === idx && dragIndexRef.current !== null && dragIndexRef.current !== idx && <InsertLine />}

                  <div
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
                    onDragEnd={cleanup}
                    className={cn(
                      "rounded-xl border p-3 transition-[border-color,background-color,box-shadow] duration-200",
                      hasError ? "border-destructive/40 bg-destructive/5 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]" : "border-border",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="cursor-grab active:cursor-grabbing pt-1 text-muted shrink-0">
                        <GripVertical className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted tabular-nums shrink-0">#{idx + 1}</span>
                          {isNonDraft && (
                            <Badge variant={QUESTION_STATUS_VARIANTS[q.status] ?? "secondary"} className="shrink-0">
                              {QUESTION_STATUS_LABELS[q.status] ?? q.status}
                            </Badge>
                          )}
                          {hasError && (
                            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-all duration-200">
                              Testo richiesto
                            </span>
                          )}
                          <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                            {q.text || <span className="text-muted italic">Nuova domanda</span>}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleCollapse(q.id)}
                            aria-expanded={!isCollapsed}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
                            title={isCollapsed ? "Espandi" : "Comprimi"}
                          >
                            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeQuestion(idx)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-destructive"
                            title="Rimuovi"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div
                          className={cn(
                            "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
                            isCollapsed ? "mt-0 grid-rows-[0fr] opacity-0" : "mt-3 grid-rows-[1fr] opacity-100",
                          )}
                        >
                          <div className="overflow-hidden">
                            <div className="space-y-3 pb-0.5">
                              {/* Question text */}
                              <div className="relative">
                                <MessageSquare className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                                <Input
                                  data-question-text={idx}
                                  value={q.text}
                                  onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } }}
                                  placeholder={hasError ? "Il testo è obbligatorio" : "Testo della domanda"}
                                  className={cn(
                                    "pl-8",
                                    QUESTION_FIELD_FOCUS,
                                    hasError && "border-destructive/50 bg-destructive/5 placeholder:text-destructive/60",
                                  )}
                                />
                              </div>
                              <div
                                className={cn(
                                  "grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out",
                                  hasError ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 -translate-y-1",
                                )}
                              >
                                <div className="overflow-hidden">
                                  <p className="pt-1 text-xs font-medium text-destructive">
                                    Inserisci il testo della domanda prima di salvare.
                                  </p>
                                </div>
                              </div>

                              {/* Type + Audience */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted flex items-center gap-1">
                                    <AlignLeft className="h-3 w-3" /> Tipo
                                  </Label>
                                  <Select
                                    value={q.inputType}
                                    onChange={(e) => updateQuestion(idx, { inputType: e.target.value, options: [] })}
                                    className={QUESTION_FIELD_FOCUS}
                                  >
                                    {Object.entries(INPUT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted flex items-center gap-1">
                                    <Users className="h-3 w-3" /> Audience
                                  </Label>
                                  <Select
                                    value={q.audienceType}
                                    onChange={(e) => updateQuestion(idx, { audienceType: e.target.value })}
                                    className={QUESTION_FIELD_FOCUS}
                                  >
                                    <option value="CLASS">Classe</option>
                                    <option value="INDIVIDUAL">Individuale</option>
                                  </Select>
                                </div>
                              </div>

                              {/* Timer chips + custom */}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Durata
                                </Label>
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] gap-2">
                                  {TIMER_PRESETS.map((preset) => {
                                    const isSelected = q.timerSeconds === preset.value;
                                    return (
                                      <button
                                        key={String(preset.value)}
                                        type="button"
                                        onClick={() => updateQuestion(idx, { timerSeconds: preset.value })}
                                        className={`flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold transition-colors ${
                                          isSelected
                                            ? "border-accent bg-accent text-accent-foreground"
                                            : "border-border text-muted hover:bg-surface-raised"
                                        }`}
                                      >
                                        {preset.value === null
                                          ? <Infinity className="h-4 w-4" />
                                          : preset.label}
                                      </button>
                                    );
                                  })}
                                  <div
                                    className={cn(
                                      "relative flex h-11 items-center rounded-xl border transition-[border-color,background-color] duration-200",
                                      isCustomTimer
                                        ? "border-accent bg-accent-subtle"
                                        : "border-border bg-surface",
                                    )}
                                  >
                                    <input
                                      type="number"
                                      value={q.timerSeconds ?? ""}
                                      onChange={(e) =>
                                        updateQuestion(idx, {
                                          timerSeconds: e.target.value === "" ? null : Math.max(1, Number(e.target.value)),
                                        })}
                                      min={1}
                                      placeholder="sec"
                                      className={cn(
                                        "h-full w-full rounded-[inherit] border-0 bg-transparent px-3 pr-7 text-center text-sm font-semibold tabular-nums shadow-none outline-none [appearance:textfield] [-moz-appearance:textfield] placeholder:font-medium placeholder:text-muted",
                                        "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                                        "focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                                        isCustomTimer ? "text-accent" : "text-foreground",
                                      )}
                                    />
                                    <span className={cn("pointer-events-none absolute right-3 text-sm font-medium", isCustomTimer ? "text-accent" : "text-muted")}>
                                      s
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Options (choice types) */}
                              {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.inputType) && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted flex items-center gap-1">
                                    <List className="h-3 w-3" /> Opzioni
                                  </Label>
                                  {q.options.map((option, optIdx) => (
                                    <div key={optIdx} className="flex gap-2">
                                      <div className="relative flex-1">
                                        <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
                                        <Input
                                          data-option={`${idx}-${optIdx}`}
                                          value={option}
                                          onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(idx); } }}
                                          placeholder={`Opzione ${optIdx + 1}`}
                                          className={cn("pl-7", QUESTION_FIELD_FOCUS)}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeOption(idx, optIdx)}
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-destructive"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addOption(idx)}
                                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                                  >
                                    <Plus className="h-3 w-3" /> Aggiungi opzione
                                  </button>
                                </div>
                              )}

                              {/* Scale settings */}
                              {q.inputType === "SCALE" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted flex items-center gap-1">
                                    <SlidersHorizontal className="h-3 w-3" /> Scala (min · max · step)
                                  </Label>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Input
                                      type="number"
                                      value={q.settings?.min ?? 1}
                                      placeholder="Min"
                                      onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, min: +e.target.value } })}
                                      className={QUESTION_FIELD_FOCUS}
                                    />
                                    <Input
                                      type="number"
                                      value={q.settings?.max ?? 10}
                                      placeholder="Max"
                                      onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, max: +e.target.value } })}
                                      className={QUESTION_FIELD_FOCUS}
                                    />
                                    <Input
                                      type="number"
                                      value={q.settings?.step ?? 1}
                                      placeholder="Step"
                                      onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, step: +e.target.value } })}
                                      className={QUESTION_FIELD_FOCUS}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Word cloud settings */}
                              {q.inputType === "WORD_COUNT" && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted flex items-center gap-1">
                                    <Hash className="h-3 w-3" /> Parole massime
                                  </Label>
                                  <Input
                                    type="number"
                                    value={q.settings?.maxWords ?? 3}
                                    min={1}
                                    className={cn("w-24", QUESTION_FIELD_FOCUS)}
                                    onChange={(e) => updateQuestion(idx, { settings: { ...q.settings, maxWords: +e.target.value } })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {insertAt === payload.questions.length && dragIndexRef.current !== null && <InsertLine />}
            <div ref={questionsEndRef} />
          </CardContent>
        </Card>
      )}

      {/* ── Floating save button — slides in when dirty, slides out showing "Salvataggio…" ── */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 transition-transform duration-300 ease-out ${
          saveAnimatingOut || !saveVisible ? "translate-y-24 pointer-events-none" : "translate-y-0"
        }`}
      >
        <div
          className={cn(
            "grid w-full max-w-xs transition-[grid-template-rows,opacity,transform] duration-250 ease-out",
            saveError ? "grid-rows-[1fr] opacity-100 translate-y-0" : "grid-rows-[0fr] opacity-0 translate-y-1 pointer-events-none",
          )}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg bg-destructive px-3 py-2 text-sm text-white shadow-lg">
              {saveError ?? ""}
            </div>
          </div>
        </div>
        <Button onClick={save} disabled={saveBusy} size="lg" className="gap-2 shadow-xl disabled:opacity-100">
          <Save className="h-4 w-4" />
          {saveBusy ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
