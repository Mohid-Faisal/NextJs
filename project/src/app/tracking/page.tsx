"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";
import PublicNavbar from "@/components/PublicNavbar";

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const [organization, setOrganization] = useState<{ id: number; name: string } | null>(null);

  // If organization is loaded and is not super admin (ID 1), hide the navbar
  const showNavbar = !organization || organization.id === 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {showNavbar && <PublicNavbar />}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl mx-auto">
          <TrackingResultsDialog
            asPage
            initialBookingId={bookingId}
            autoSearch
            onOrganizationLoaded={(org) => setOrganization(org)}
          />
        </div>
      </div>
    </div>
  );
}
