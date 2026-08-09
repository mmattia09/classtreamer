import { describe, expect, test } from "bun:test";

import {
  formatTimerRemaining,
  getQuestionTimerState,
  isQuestionExpiredAt,
} from "@/lib/question-timer";

const OPENED_AT = "2026-01-01T10:00:00.000Z";
const openedAtMs = Date.parse(OPENED_AT);

describe("getQuestionTimerState", () => {
  test("no timer configured", () => {
    expect(getQuestionTimerState({ openedAt: OPENED_AT, timerSeconds: null }, openedAtMs)).toEqual({
      kind: "none",
    });
  });

  test("pending until the question is opened", () => {
    expect(getQuestionTimerState({ openedAt: null, timerSeconds: 60 }, openedAtMs)).toEqual({
      kind: "pending",
    });
  });

  // The clock is null while rendering on the server, where there is no
  // meaningful "now" to compare against.
  test("pending while the clock is unavailable", () => {
    expect(getQuestionTimerState({ openedAt: OPENED_AT, timerSeconds: 60 }, null)).toEqual({
      kind: "pending",
    });
  });

  test("counts down while running", () => {
    const state = getQuestionTimerState(
      { openedAt: OPENED_AT, timerSeconds: 60 },
      openedAtMs + 20_000,
    );
    expect(state).toEqual({ kind: "active", remainingSeconds: 40 });
  });

  test("rounds a partial second up, so it never shows 0 while still open", () => {
    const state = getQuestionTimerState(
      { openedAt: OPENED_AT, timerSeconds: 60 },
      openedAtMs + 59_500,
    );
    expect(state).toEqual({ kind: "active", remainingSeconds: 1 });
  });

  test("expires exactly at the deadline", () => {
    expect(
      getQuestionTimerState({ openedAt: OPENED_AT, timerSeconds: 60 }, openedAtMs + 60_000),
    ).toEqual({ kind: "expired" });
  });

  test("expired well past the deadline", () => {
    expect(
      getQuestionTimerState({ openedAt: OPENED_AT, timerSeconds: 60 }, openedAtMs + 600_000),
    ).toEqual({ kind: "expired" });
  });

  test("a null or undefined question has no timer", () => {
    expect(getQuestionTimerState(null, openedAtMs)).toEqual({ kind: "none" });
    expect(getQuestionTimerState(undefined, openedAtMs)).toEqual({ kind: "none" });
  });
});

describe("isQuestionExpiredAt", () => {
  test("false while running, true past the deadline", () => {
    const question = { openedAt: OPENED_AT, timerSeconds: 30 };
    expect(isQuestionExpiredAt(question, openedAtMs + 10_000)).toBe(false);
    expect(isQuestionExpiredAt(question, openedAtMs + 30_000)).toBe(true);
  });

  test("a question without a timer never expires", () => {
    expect(isQuestionExpiredAt({ openedAt: OPENED_AT, timerSeconds: null }, Infinity)).toBe(false);
  });
});

describe("formatTimerRemaining", () => {
  test("pads seconds to two digits", () => {
    expect(formatTimerRemaining(65)).toBe("1:05");
    expect(formatTimerRemaining(5)).toBe("0:05");
  });

  test("handles whole minutes and zero", () => {
    expect(formatTimerRemaining(120)).toBe("2:00");
    expect(formatTimerRemaining(0)).toBe("0:00");
  });
});
