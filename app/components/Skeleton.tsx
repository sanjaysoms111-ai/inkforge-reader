export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-[var(--bg-elev)] animate-pulse rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function ChapterListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ className = "h-[420px]" }: { className?: string }) {
  return <Skeleton className={`w-full rounded-lg ${className}`} />;
}
