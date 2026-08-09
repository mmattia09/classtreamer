/**
 * Placeholder shown while an admin page streams in. Those pages are
 * force-dynamic and run several queries, so without a loading state the browser
 * sits on the previous screen with no feedback after a navigation.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-surface-raised" />
        <div className="h-4 w-72 rounded bg-surface-raised" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="h-14 rounded-xl bg-surface-raised" />
        ))}
      </div>
    </div>
  );
}
