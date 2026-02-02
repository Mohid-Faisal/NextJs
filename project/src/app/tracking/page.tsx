"use client";

import { useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";

  return (
    <TrackingResultsDialog
      asPage
      initialBookingId={bookingId}
      autoSearch
    />
  );
}
