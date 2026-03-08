"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 text-sm text-slate-500">
          <Link href="/" className="hover:text-sky-500">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-sky-500 font-medium">Tools</span>
        </div>

        <div className="rounded-3xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-linear-to-r from-sky-600 to-blue-700 px-6 sm:px-10 py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">
              Tools
            </h1>
            <p className="text-sky-100 max-w-2xl text-sm sm:text-base">
              Find the right shipping and support tools to plan your deliveries,
              calculate costs and check whether a destination is classified as a
              remote area.
            </p>
          </div>

          <div className="px-6 sm:px-10 py-8 grid gap-8 lg:grid-cols-[2fr,1.3fr]">
            <div className="space-y-4 text-slate-700 text-sm sm:text-base leading-relaxed">
              <p>
                Use these online tools to prepare your parcels and shipments
                before booking. You can estimate delivery costs, calculate
                volumetric weight and check whether a postcode or town is
                considered remote.
              </p>
              <p>
                You can then continue to our rate calculator or tracking pages
                to get quotes and follow your consignments.
              </p>
            </div>

            <div className="space-y-3">
              <ToolLink href="/rate-calculator" label="Rate calculator" />
              <ToolLink href="/tracking" label="Shipment tracking" />
              <ToolLink
                href="/tools/volumetric-calculator"
                label="Parcel volume calculator"
              />
              <ToolLink
                href="/tools/remote-area-lookup"
                label="Remote area lookup"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors"
    >
      <span>{label}</span>
      <ArrowRight className="w-4 h-4 text-sky-500" />
    </Link>
  );
}

