"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";
import { Button } from "@/components/ui/button";

export default function TrackingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // If query changes (or user arrives), ensure dialog is open.
    setOpen(true);
  }, [bookingId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TrackingResultsDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) router.push("/");
        }}
        initialBookingId={bookingId}
        autoSearch
      />

      {!open && (
        <div className="max-w-xl mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tracking</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            The tracking dialog was closed.
          </p>
          <div className="mt-6 flex justify-center gap-3">
              <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setOpen(true)}
            >
              Open Tracking
            </Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go Home
              </Button>
          </div>
        </div>
      )}
    </div>
  );
}

