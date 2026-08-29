export default function Loading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-h-[calc(100vh-64px)] bg-white dark:bg-zinc-900 space-y-6">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-9 w-64 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-4 w-96 max-w-full rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
      </div>
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse"
          />
        ))}
      </div>
      {/* Chart + table skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
        <div className="h-72 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
      </div>
      <div className="h-64 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800/60 animate-pulse" />
    </div>
  );
}
