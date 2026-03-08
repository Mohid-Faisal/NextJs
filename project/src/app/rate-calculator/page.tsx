"use client";

import Link from "next/link";
import RateCalculatorContent from "@/components/RateCalculatorContent";

export default function RateCalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        <nav className="mb-4 text-sm text-slate-500">
          <Link href="/" className="hover:text-sky-500">
            Home
          </Link>
          <span className="mx-2">›</span>
          <Link href="/tools" className="hover:text-sky-500">
            Tools
          </Link>
          <span className="mx-2">›</span>
          <span className="text-sky-500 font-medium">Rate calculator</span>
        </nav>
        <RateCalculatorContent publicView />
      </div>
    </div>
  );
}
