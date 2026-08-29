"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message,
        digest: error?.digest,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900">
          <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
          An unexpected error occurred. Your data is safe — please try again.
          {error?.digest ? (
            <span className="block mt-1 text-xs text-slate-400">Reference: {error.digest}</span>
          ) : null}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <RotateCw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-zinc-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
