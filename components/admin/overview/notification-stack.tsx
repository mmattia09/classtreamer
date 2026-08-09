"use client";

import { Bell } from "lucide-react";

import type { Notification } from "@/components/admin/overview/use-notifications";

const TONE_STYLES: Record<Notification["tone"], string> = {
  success: "bg-success-subtle text-success-foreground",
  warning: "bg-warning-subtle text-warning-foreground",
  info: "bg-accent-subtle text-accent",
};

export function NotificationStack({ notifications }: { notifications: Notification[] }) {
  return (
    // aria-live so a live event is announced rather than only shown.
    <div
      className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {notifications.map((entry) => (
        <div
          key={entry.id}
          className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-lg animate-slide-up"
        >
          <div
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TONE_STYLES[entry.tone]}`}
          >
            <Bell className="h-2.5 w-2.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{entry.title}</p>
            {entry.description ? (
              <p className="mt-0.5 truncate text-xs text-muted">{entry.description}</p>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
