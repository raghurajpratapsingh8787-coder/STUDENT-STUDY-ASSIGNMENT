export function SkeletonLine({ className = 'h-4 w-full' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <SkeletonLine className="h-3.5 w-28" />
      <SkeletonLine className="h-7 w-20" />
      <SkeletonLine className="h-3 w-36" />
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 py-2.5 border-b border-slate-100 dark:border-slate-800/80 last:border-b-0"
        >
          <div className="space-y-2 flex-1">
            <SkeletonLine className="h-4 w-2/5" />
            <SkeletonLine className="h-3 w-1/3" />
          </div>
          <SkeletonLine className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
