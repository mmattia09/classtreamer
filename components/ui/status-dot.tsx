import { cn } from "@/lib/utils";

export function StatusDot({
  connected,
  className,
}: {
  connected: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground shadow-xs",
        className,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          connected
            ? "bg-success shadow-[0_0_8px_rgb(34_197_94/0.6)]"
            : "bg-destructive animate-pulse",
        )}
      />
      {connected ? "Connesso" : "Riconnessione..."}
    </span>
  );
}
