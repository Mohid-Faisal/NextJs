"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <nav className="mb-4 text-sm text-slate-500">
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
        <TrackingResultsDialog
          asPage
          initialBookingId={bookingId}
          autoSearch
        />
      </div>
    </div>
  );
}
