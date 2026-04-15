"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  async function save() {
    const response = await fetch(stream ? `/api/streams/${stream.id}` : "/api/streams", {
      method: stream ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    router.push(`/admin/streams/${data.id}`);
    router.refresh();
  }

  function addQuestion() {
    setPayload((current) => ({
      ...current,
      questions: [
        ...current.questions,
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
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,247,255,0.92))] p-5 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Preview</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Anteprima stream</h2>
            </div>
            <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ocean">
              {payload.status}
            </span>
          </div>
          <div className="mt-5 overflow-hidden rounded-[28px] border border-ocean/10 bg-ink">
            {payload.embedUrl ? (
              <iframe src={payload.embedUrl} className="min-h-[280px] w-full" allow="fullscreen; autoplay" />
            ) : (
              <div className="flex min-h-[280px] items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,#10243a,#08121f)] p-8 text-center text-white/75">
                Inserisci un link embed per visualizzare l’anteprima della live.
              </div>
            )}
          </div>
        </Card>

        <Card className="space-y-5 bg-white/90 shadow-none">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Dettagli</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Impostazioni live</h2>
              <p className="mt-1 text-sm text-ink/60">Titolo, link, programmazione e salvataggio.</p>
            </div>
            <Button onClick={save}>Salva</Button>
          </div>
          <label className="space-y-2 text-sm font-semibold text-ink/70">
            Titolo della stream
            <input
              value={payload.title}
              onChange={(event) => setPayload((current) => ({ ...current, title: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-ocean/10 px-4 text-base font-normal"
              placeholder="Titolo"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-ink/70">
            URL embed
            <input
              value={payload.embedUrl}
              onChange={(event) => setPayload((current) => ({ ...current, embedUrl: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-ocean/10 px-4 text-base font-normal"
              placeholder="URL embed"
            />
          </label>
          <label className="space-y-2 text-sm font-semibold text-ink/70">
            Programmazione
            <input
              type="datetime-local"
              value={payload.scheduledAt}
              onChange={(event) => setPayload((current) => ({ ...current, scheduledAt: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-ocean/10 px-4 text-base font-normal"
            />
          </label>
          <div className="rounded-[24px] border border-ocean/10 bg-ocean/5 p-4 text-sm text-ink/65">
            {payload.targetClassIds.length
              ? `${payload.targetClassIds.length} classi selezionate per questa stream.`
              : "Nessuna classe selezionata: la stream sarà visibile a tutte le classi."}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.22fr_0.78fr]">
        <Card className="space-y-5 bg-white/90 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Question desk</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Domande preparate</h2>
              <p className="mt-1 text-sm text-ink/60">Ordina e definisci il comportamento di ogni domanda prima della live.</p>
            </div>
            <Button variant="secondary" onClick={addQuestion}>
              Aggiungi domanda
            </Button>
          </div>
          <div className="space-y-4">
            {payload.questions.map((question, index) => (
              <div key={question.id} className="space-y-3 rounded-[28px] border border-ocean/10 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean/70">Domanda {index + 1}</p>
                  <span className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold text-ocean">{question.status}</span>
                </div>
                <input
                  value={question.text}
                  onChange={(event) =>
                    setPayload((current) => ({
                      ...current,
                      questions: current.questions.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, text: event.target.value } : item,
                      ),
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-ocean/10 px-4"
                  placeholder="Testo domanda"
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
                    Tipo
                    <select
                      value={question.inputType}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, inputType: event.target.value } : item,
                          ),
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-ocean/10 px-3 text-sm font-medium text-ink"
                    >
                      <option value="OPEN">Aperta</option>
                      <option value="WORD_COUNT">Word cloud</option>
                      <option value="SCALE">Scala</option>
                      <option value="SINGLE_CHOICE">Scelta singola</option>
                      <option value="MULTIPLE_CHOICE">Scelta multipla</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
                    Audience
                    <select
                      value={question.audienceType}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, audienceType: event.target.value } : item,
                          ),
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-ocean/10 px-3 text-sm font-medium text-ink"
                    >
                      <option value="CLASS">Classe</option>
                      <option value="INDIVIDUAL">Individuale</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/50">
                    Timer
                    <input
                      type="number"
                      value={question.timerSeconds ?? 60}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, timerSeconds: Number(event.target.value) } : item,
                          ),
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-ocean/10 px-3 text-sm font-medium text-ink"
                      placeholder="Timer"
                    />
                  </label>
                </div>
                {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(question.inputType) ? (
                  <textarea
                    value={question.options.join("\n")}
                    onChange={(event) =>
                      setPayload((current) => ({
                        ...current,
                        questions: current.questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                options: event.target.value
                                  .split("\n")
                                  .map((entry) => entry.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      }))
                    }
                    className="min-h-24 w-full rounded-2xl border border-ocean/10 px-4 py-3"
                    placeholder="Una opzione per riga"
                  />
                ) : null}
                {question.inputType === "SCALE" ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    <input
                      type="number"
                      value={question.settings?.min ?? 1}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  settings: {
                                    ...item.settings,
                                    min: Number(event.target.value),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      value={question.settings?.max ?? 10}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  settings: {
                                    ...item.settings,
                                    max: Number(event.target.value),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      placeholder="Max"
                    />
                    <input
                      type="number"
                      value={question.settings?.step ?? 1}
                      onChange={(event) =>
                        setPayload((current) => ({
                          ...current,
                          questions: current.questions.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  settings: {
                                    ...item.settings,
                                    step: Number(event.target.value),
                                  },
                                }
                              : item,
                          ),
                        }))
                      }
                      className="h-12 rounded-2xl border border-ocean/10 px-3"
                      placeholder="Step"
                    />
                  </div>
                ) : null}
                {question.inputType === "WORD_COUNT" ? (
                  <input
                    type="number"
                    value={question.settings?.maxWords ?? 3}
                    onChange={(event) =>
                      setPayload((current) => ({
                        ...current,
                        questions: current.questions.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                settings: {
                                  ...item.settings,
                                  maxWords: Number(event.target.value),
                                },
                              }
                            : item,
                        ),
                      }))
                    }
                    className="h-12 w-full rounded-2xl border border-ocean/10 px-3"
                    placeholder="Numero massimo di parole"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-5 bg-white/90 shadow-none">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-ocean/70">Audience</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Classi</h2>
            <p className="mt-1 text-sm text-ink/60">Seleziona le classi abilitate. Se non scegli nulla, la live è visibile a tutte.</p>
          </div>
          <div className="space-y-2">
            {classes.map((entry) => {
              const key = entry.id;
              const checked = payload.targetClassIds.includes(key);
              return (
                <label key={entry.id} className="flex items-center gap-3 rounded-2xl border border-ocean/10 bg-white px-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setPayload((current) => ({
                        ...current,
                        targetClassIds: event.target.checked
                          ? [...current.targetClassIds, key]
                          : current.targetClassIds.filter((item) => item !== key),
                      }))
                    }
                  />
                  <span>{entry.displayName ?? `${getYearLabel(entry.year)}${entry.section}`}</span>
                </label>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
