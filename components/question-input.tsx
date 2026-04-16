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

  const scaleRange = useMemo(() => ({
    min: Number(question.settings?.min ?? 1),
    max: Number(question.settings?.max ?? 5),
    step: Number(question.settings?.step ?? 1),
  }), [question.settings]);

  const maxWords = Number(question.settings?.maxWords ?? 3);
  const wordsUsed = text.trim().split(/\s+/).filter(Boolean).length;

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
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => {
              const v = e.target.value;
              if (question.inputType === "WORD_COUNT") {
                const words = v.trim().split(/\s+/).filter(Boolean);
                if (words.length > maxWords) { setText(words.slice(0, maxWords).join(" ")); return; }
              }
              setText(v);
            }}
            className="min-h-28 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base text-foreground placeholder:text-muted resize-none outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background transition-shadow"
            placeholder={question.inputType === "WORD_COUNT" ? `Fino a ${maxWords} parole` : "Scrivi la tua risposta"}
            disabled={disabled || submitting}
          />
          {question.inputType === "WORD_COUNT" ? (
            <p className="text-xs text-muted text-right">{wordsUsed}/{maxWords}</p>
          ) : null}
        </div>
      )}

      {question.inputType === "SCALE" && (
        <div className="space-y-4">
          <div className="flex justify-between text-xs text-muted">
            <span>{scaleRange.min}</span>
            <span className="text-3xl font-bold text-accent">{scale}</span>
            <span>{scaleRange.max}</span>
          </div>
          <input
            type="range"
            min={scaleRange.min}
            max={scaleRange.max}
            step={scaleRange.step}
            value={scale}
            onChange={(e) => setScale(e.target.value)}
            disabled={disabled || submitting}
            className="w-full accent-accent h-2"
          />
        </div>
      )}

      {question.inputType === "SINGLE_CHOICE" && (
        <div className="space-y-2">
          {question.options?.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-surface-raised has-[:checked]:border-accent has-[:checked]:bg-accent-subtle"
            >
              <input
                type="radio"
                value={option}
                checked={single === option}
                onChange={(e) => setSingle(e.target.value)}
                disabled={disabled || submitting}
                className="accent-accent"
              />
              <span className="text-base text-foreground">{option}</span>
            </label>
          ))}
        </div>
      )}

      {question.inputType === "MULTIPLE_CHOICE" && (
        <div className="space-y-2">
          {question.options?.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-surface-raised has-[:checked]:border-accent has-[:checked]:bg-accent-subtle"
            >
              <input
                type="checkbox"
                value={option}
                checked={multiple.includes(option)}
                onChange={(e) =>
                  setMultiple((cur) =>
                    e.target.checked ? [...cur, option] : cur.filter((i) => i !== option),
                  )
                }
                disabled={disabled || submitting}
                className="accent-accent"
              />
              <span className="text-base text-foreground">{option}</span>
            </label>
          ))}
        </div>
      )}

      <Button onClick={submit} disabled={disabled || submitting} size="lg" className="w-full">
        {submitting ? "Invio..." : "Invia risposta"}
      </Button>
    </div>
  );
}
