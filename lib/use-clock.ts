"use client";

import { useSyncExternalStore } from "react";

/**
 * A once-per-second clock shared by every component that needs one.
 *
 * Subscribing through useSyncExternalStore rather than seeding state from an
 * effect keeps the countdown out of the "setState inside useEffect" pattern,
 * and a single interval drives every consumer instead of one per component.
 *
 * Returns null while rendering on the server, where there is no meaningful
 * "now" to render and any value would differ from the client's on hydration.
 */

const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  // Refresh immediately: `now` may be stale if the module was loaded a while
  // ago and no consumer was mounted since.
  now = Date.now();
  listeners.add(onChange);

  if (!timer) {
    timer = setInterval(() => {
      now = Date.now();
      for (const listener of listeners) listener();
    }, 1000);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number | null {
  return now;
}

function getServerSnapshot(): number | null {
  return null;
}

export function useClock(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
