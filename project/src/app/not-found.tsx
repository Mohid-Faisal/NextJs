import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4">
      <div className="max-w-md w-full text-center">
        <p className="text-6xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400 mb-3">
          404
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Page not found
        </h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
          The page you are looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
