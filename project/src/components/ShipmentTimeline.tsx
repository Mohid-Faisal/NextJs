"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Clock,
  Copy,
  Check,
  QrCode,
  MapPin,
  Truck,
  Package,
  ShieldCheck,
  Home,
  X,
  ExternalLink,
} from "lucide-react";

interface TimelineEvent {
  status: string;
  timestamp: string;
  location?: string;
  description?: string;
}

interface ShipmentTimelineProps {
  currentStatus: string;
  trackingNumber: string;
  destination?: string;
  events?: TimelineEvent[];
  className?: string;
}

const MILESTONES = [
  { key: "booked", label: "Booked", icon: Package },
  { key: "picked up", label: "Picked Up", icon: Truck },
  { key: "in transit", label: "In Transit", icon: Clock },
  { key: "customs cleared", label: "Customs Cleared", icon: ShieldCheck },
  { key: "out for delivery", label: "Out for Delivery", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: Home },
];

function getMilestoneIndex(status: string): number {
  const norm = (status || "").toLowerCase().trim();
  if (norm.includes("deliver")) return 5;
  if (norm.includes("out for")) return 4;
  if (norm.includes("custom")) return 3;
  if (norm.includes("transit") || norm.includes("depart") || norm.includes("arrived")) return 2;
  if (norm.includes("picked") || norm.includes("pickup") || norm.includes("origin")) return 1;
  return 0; // Booked / created
}

export default function ShipmentTimeline({
  currentStatus = "Booked",
  trackingNumber,
  destination,
  events = [],
  className = "",
}: ShipmentTimelineProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const activeIndex = getMilestoneIndex(currentStatus);
  const isDelivered = activeIndex === 5;

  const publicTrackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tracking?bookingId=${encodeURIComponent(trackingNumber)}`
      : `/tracking?bookingId=${encodeURIComponent(trackingNumber)}`;

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(publicTrackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs ${className}`}
    >
      {/* Header with Tracking Info & Share actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Live Shipment Journey
            </span>
            {isDelivered ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Delivered
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 animate-pulse">
                {currentStatus || "In Progress"}
              </span>
            )}
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-zinc-100 mt-0.5 font-mono">
            {trackingNumber}
          </div>
          {destination && (
            <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              Destination: <span className="font-semibold">{destination}</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Copy Link & QR Modal */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-750"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Link Copied!" : "Copy Link"}
          </button>

          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-750 transition-all cursor-pointer"
            title="Show Mobile QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>QR Code</span>
          </button>
        </div>
      </div>

      {/* Progress Milestone Stepper */}
      <div className="py-6">
        <div className="grid grid-cols-6 gap-1 relative">
          {/* Background Track Line */}
          <div className="absolute top-4 left-6 right-6 h-1 bg-slate-100 dark:bg-zinc-800 -z-0" />
          
          {/* Active Filled Track Line */}
          <div
            className="absolute top-4 left-6 h-1 bg-linear-to-r from-indigo-500 via-teal-500 to-emerald-500 transition-all duration-500 -z-0"
            style={{
              width: `calc(${(activeIndex / (MILESTONES.length - 1)) * 100}% - 48px)`,
            }}
          />

          {MILESTONES.map((milestone, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;
            const isPending = idx > activeIndex;
            const Icon = milestone.icon;

            return (
              <div key={milestone.key} className="flex flex-col items-center text-center relative z-10">
                {/* Node Icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : isCurrent
                      ? "bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950 shadow-lg shadow-indigo-500/30 scale-110"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <CircleDot className="w-4 h-4 animate-spin-slow" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Milestone Label */}
                <div className="mt-2.5">
                  <div
                    className={`text-[11px] font-bold leading-tight ${
                      isCurrent
                        ? "text-indigo-600 dark:text-indigo-400"
                        : isCompleted
                        ? "text-slate-800 dark:text-zinc-200"
                        : "text-slate-400 dark:text-zinc-600"
                    }`}
                  >
                    {milestone.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* History Log Timeline (if history items provided) */}
      {events && events.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-3">
            Journey Logs
          </div>
          <div className="space-y-3">
            {events.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">
                    {e.status}
                    {e.location && (
                      <span className="text-slate-500 dark:text-zinc-400 font-normal ml-2">
                        • {e.location}
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <div className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">
                      {e.description}
                    </div>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 shrink-0 font-mono">
                  {e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setShowQR(false)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Scan to Track Shipment
              </div>
              <button
                onClick={() => setShowQR(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Render Public QR using Google Charts QR API or canvas */}
            <div className="flex justify-center p-4 bg-white rounded-2xl border border-slate-100 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  publicTrackingUrl
                )}`}
                alt="Tracking QR Code"
                className="w-44 h-44 object-contain"
              />
            </div>

            <div className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
              {trackingNumber}
            </div>

            <div className="pt-2">
              <a
                href={publicTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                <span>Open Tracking Page</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
