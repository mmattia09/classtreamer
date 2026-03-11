"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { QuestionPayload } from "@/lib/types";

type Props = {
  question: QuestionPayload;
  onSubmit: (value: unknown) => Promise<void>;
  disabled?: boolean;
};

export function QuestionInput({ question, onSubmit, disabled }: Props) {
  const [text, setText] = useState("");
  const [single, setSingle] = useState("");
  const [multiple, setMultiple] = useState<string[]>([]);
  const [scale, setScale] = useState(String(question.settings?.min ?? 1));
  const [submitting, setSubmitting] = useState(false);

  const scaleRange = useMemo(() => {
    const min = Number(question.settings?.min ?? 1);
    const max = Number(question.settings?.max ?? 5);
    const step = Number(question.settings?.step ?? 1);
    return { min, max, step };
  }, [question.settings]);

  async function submit() {
    setSubmitting(true);
    try {
      if (question.inputType === "OPEN" || question.inputType === "WORD_COUNT") {
        await onSubmit({ text });
      } else if (question.inputType === "SCALE") {
        await onSubmit({ value: Number(scale) });
      } else if (question.inputType === "MULTIPLE_CHOICE") {
        await onSubmit({ values: multiple });
      } else {
        await onSubmit({ value: single });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {(question.inputType === "OPEN" || question.inputType === "WORD_COUNT") && (
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-h-28 w-full rounded-2xl border border-ocean/15 bg-white px-4 py-3 text-lg outline-none ring-ocean/20 transition focus:ring-4"
          placeholder="Scrivi qui la tua risposta"
          disabled={disabled || submitting}
        />
      )}

      {question.inputType === "SCALE" && (
        <div className="space-y-3">
          <input
            type="range"
            min={scaleRange.min}
            max={scaleRange.max}
            step={scaleRange.step}
            value={scale}
            onChange={(event) => setScale(event.target.value)}
            disabled={disabled || submitting}
            className="w-full accent-ocean"
          />
          <div className="text-center text-3xl font-semibold text-ocean">{scale}</div>
        </div>
      )}

      {question.inputType === "SINGLE_CHOICE" && (
        <div className="grid gap-3 md:grid-cols-2">
          {question.options?.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ocean/15 bg-white px-4 py-4"
            >
              <input
                type="radio"
                value={option}
                checked={single === option}
                onChange={(event) => setSingle(event.target.value)}
                disabled={disabled || submitting}
              />
              <span className="text-lg">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.inputType === "MULTIPLE_CHOICE" && (
        <div className="grid gap-3 md:grid-cols-2">
          {question.options?.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ocean/15 bg-white px-4 py-4"
            >
              <input
                type="checkbox"
                value={option}
                checked={multiple.includes(option)}
                onChange={(event) =>
                  setMultiple((current) =>
                    event.target.checked
                      ? [...current, option]
                      : current.filter((item) => item !== option),
                  )
                }
                disabled={disabled || submitting}
              />
              <span className="text-lg">{option}</span>
            </label>
          ))}
        </div>
      )}

      <Button onClick={submit} disabled={disabled || submitting} className="h-14 w-full text-lg">
        Invia risposta
      </Button>
    </div>
  );
}
