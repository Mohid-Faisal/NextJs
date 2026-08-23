export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      {/* Top bar skeleton */}
      <div className="h-16 border-b border-slate-200/60 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 animate-pulse" />
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse"
            />
          ))}
        </div>
        {/* Chart + table skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
          <div className="h-72 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
        </div>
        <div className="h-64 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
      </div>
    </div>
  );
}
