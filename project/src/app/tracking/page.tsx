import { Suspense } from "react";
import type { Metadata } from "next";
import TrackingPageClient from "./TrackingPageClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildPageMetadata, getBreadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Track Your Shipment",
  description:
    "Track your courier and cargo shipments in real time with Proxima Smart Solutions (PSS). Enter your booking ID or tracking number for live delivery milestones.",
  path: "/tracking",
  keywords: [
    "shipment tracking",
    "track courier package",
    "real-time cargo tracking",
    "PSS tracking",
    "booking ID lookup",
  ],
});

export default function TrackingPage() {
  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Track Shipment", path: "/tracking" },
        ])}
      />
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading shipment tracker...
            </p>
          </div>
        }
      >
        <TrackingPageClient />
      </Suspense>
    </>
  );
}
