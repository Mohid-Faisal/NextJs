"use client";

import RateCalculatorContent from "@/components/RateCalculatorContent";

export default function RateCalculatorPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto">
        <RateCalculatorContent />
      </div>
    </div>
  );
}
