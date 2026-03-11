"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RateCalculatorContent from "@/components/RateCalculatorContent";

function ToolsDisabledPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Page not found</h1>
        <p className="text-slate-500 text-sm">
          Public tools are currently disabled. Please contact your administrator.
        </p>
      </div>
    </div>
  );
}

export default function RateCalculatorPage() {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const loadFlag = async () => {
      try {
        const res = await fetch("/api/public-tools", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setDisabled(!!data?.disabled);
      } catch (e) {
        console.error("Failed to load public tools flag", e);
      }
    };
    loadFlag();
  }, []);

  if (disabled) {
    return <ToolsDisabledPage />;
  }

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

