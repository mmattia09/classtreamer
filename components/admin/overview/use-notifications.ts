"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NotificationTone = "info" | "success" | "warning";

export type Notification = {
  id: number;
  title: string;
  description?: string;
  tone: NotificationTone;
};

/** At most this many are on screen; older ones drop off the top. */
const MAX_VISIBLE = 4;
const DISMISS_AFTER_MS = 4500;

/**
 * Transient toasts for live events (a question opened, results updated).
 * Pending timers are cleared on unmount so a dismissal cannot fire against an
 * unmounted component.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextIdRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    const timeouts = timeoutsRef;
    return () => {
      timeouts.current.forEach(window.clearTimeout);
      timeouts.current = [];
    };
  }, []);

  const push = useCallback((title: string, description: string | undefined, tone: NotificationTone) => {
    const id = ++nextIdRef.current;
    setNotifications((current) => [...current, { id, title, description, tone }].slice(-MAX_VISIBLE));

    const timeout = window.setTimeout(() => {
      setNotifications((current) => current.filter((entry) => entry.id !== id));
      timeoutsRef.current = timeoutsRef.current.filter((entry) => entry !== timeout);
    }, DISMISS_AFTER_MS);

    timeoutsRef.current.push(timeout);
  }, []);

  return { notifications, pushNotification: push };
}
