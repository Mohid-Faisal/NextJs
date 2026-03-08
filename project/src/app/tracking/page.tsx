"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-7xl mx-auto flex gap-6">
        <div className="flex-1 min-w-0 flex justify-end">
          <nav className="mb-4 text-sm text-slate-500 text-right shrink-0">
            <Link href="/" className="hover:text-sky-500">
              Home
            </Link>
            <span className="mx-2">›</span>
            <Link href="/tools" className="hover:text-sky-500">
              Tools
            </Link>
            <span className="mx-2">›</span>
            <span className="text-sky-500 font-medium">Shipment tracking</span>
          </nav>
        </div>
        <div className="w-full max-w-4xl shrink-0">
          <TrackingResultsDialog
            asPage
            initialBookingId={bookingId}
            autoSearch
          />
        </div>
        <div className="flex-1 min-w-0 hidden lg:block" aria-hidden />
      </div>
    </div>
  );
}
