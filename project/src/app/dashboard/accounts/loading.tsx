export default function AccountsLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full min-h-[calc(100vh-64px)] bg-white dark:bg-zinc-900 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-lg bg-slate-100 dark:bg-zinc-800 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
      </div>

      {/* Financial KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800/60 p-4 flex flex-col justify-between"
          >
            <div className="h-4 w-28 rounded bg-slate-200/70 dark:bg-zinc-700 animate-pulse" />
            <div className="h-7 w-36 rounded bg-slate-200/70 dark:bg-zinc-700 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Ledger / Invoices Table Skeleton */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900">
        <div className="h-12 bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800" />
        <div className="divide-y divide-slate-100 dark:divide-zinc-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-14 px-4 flex items-center justify-between gap-4">
              <div className="h-4 w-24 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-40 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-28 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-20 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
