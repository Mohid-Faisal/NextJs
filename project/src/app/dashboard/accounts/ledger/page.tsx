"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function LedgerPage() {
  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">Ledger</h2>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6">
          <p className="text-gray-600 dark:text-gray-400">No ledger entries available.</p>
        </CardContent>
      </Card>
    </div>
  );
}


