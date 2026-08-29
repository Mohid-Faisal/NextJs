export default function CustomersLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full min-h-[calc(100vh-64px)] bg-white dark:bg-zinc-900 space-y-6">
      {/* Header + Add Customer Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
          <div className="h-4 w-64 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
      </div>

      {/* Search Bar */}
      <div className="h-10 w-80 max-w-full rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />

      {/* Table Skeleton */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="h-12 bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800" />
        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 px-4 flex items-center justify-between gap-4">
              <div className="h-4 w-32 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-44 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-28 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse hidden sm:block" />
              <div className="h-6 w-20 rounded-full bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-12 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
