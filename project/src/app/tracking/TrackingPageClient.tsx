"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import TrackingResultsDialog from "@/components/TrackingResultsDialog";

export default function TrackingPageClient() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const [organization, setOrganization] = useState<{
    id: number;
    name: string;
    logoUrl: string | null;
  } | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <h1 className="sr-only">Track Your Shipment</h1>
      {organization ? (
        <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-zinc-950/80 border-b border-slate-200/50 dark:border-zinc-800 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between gap-4">
              {/* Left Side: Logo and Name */}
              <div className="flex items-center gap-3">
                {organization.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={organization.logoUrl}
                    alt={organization.name}
                    className="h-10 w-auto max-w-[150px] object-contain"
                  />
                ) : (
                  <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center font-bold text-lg">
                    {organization.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                    {organization.name}
                  </h4>
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-extrabold mt-0.5">
                    Handling Carrier
                  </p>
                </div>
              </div>

              {/* Right Side: Active Shipment Tag */}
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                  Active Shipment
                </span>
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="w-full border-b border-slate-200/70 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm font-bold text-slate-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Proxima Smart Solutions (PSS)
            </Link>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <Link
                href="/"
                className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              >
                Home
              </Link>
              <Link
                href="/auth/login"
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>
      )}

      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl mx-auto">
          <TrackingResultsDialog
            asPage
            initialBookingId={bookingId}
            autoSearch
            onOrganizationLoaded={(org) =>
              setOrganization(
                org
                  ? {
                      id: org.id,
                      name: org.name,
                      logoUrl: (org as { logoUrl?: string | null }).logoUrl ?? null,
                    }
                  : null
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
