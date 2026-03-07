"use client";

import { useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";
import OtherToolsStrip from "@/components/OtherToolsStrip";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl mx-auto">
        <OtherToolsStrip currentTool="tracking" />
        <TrackingResultsDialog
          asPage
          initialBookingId={bookingId}
          autoSearch
        />
      </div>
    </div>
  );
}
