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
          status: "DRAFT",
          resultsVisible: false,
        },
      ],
    }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
      <Card className="space-y-5 shadow-none">
        <div>
          <h2 className="text-2xl font-semibold">Dettagli live</h2>
          <p className="text-sm text-ink/60">Imposta titolo, link e data di avvio.</p>
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
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-ocean/70">Classi abilitate</p>
          <div className="grid gap-2 md:grid-cols-2">
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
        </div>
        <Button onClick={save}>Salva stream</Button>
      </Card>

      <Card className="space-y-5 shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Domande preparate</h2>
            <p className="text-sm text-ink/60">Ordina e definisci il comportamento di ogni domanda.</p>
          </div>
          <Button variant="secondary" onClick={addQuestion}>
            Aggiungi domanda
          </Button>
        </div>
        <div className="space-y-4">
          {payload.questions.map((question, index) => (
            <div key={question.id} className="space-y-3 rounded-3xl border border-ocean/10 bg-white/70 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean/70">Domanda {index + 1}</p>
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
                    <option value="WORD_COUNT">Word count</option>
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
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
