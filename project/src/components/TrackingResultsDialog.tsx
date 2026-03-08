"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Calendar, CheckCircle2, ChevronDown, ChevronUp, Package, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCountryNameFromCode } from "@/lib/utils";
import { getTrackingUrl } from "@/lib/tracking-links";
import { AnimatePresence, motion } from "framer-motion";

type TrackingHistoryEntry = { status: string; timestamp: string; description?: string; location?: string };

interface Shipment {
  id: number;
  trackingId: string;
  invoiceNumber: string;
  destination: string;
  trackingStatus?: string | null;
  trackingStatusHistory?: TrackingHistoryEntry[] | null;
  shipmentDate: Date | string;
  createdAt: Date | string;
  totalCost?: number;
  weight?: number;
  totalWeight?: number;
  length?: number;
  width?: number;
  height?: number;
  serviceMode?: string;
  vendor?: string;
  packaging?: string;
  amount?: number;
  packages?: unknown;
}

type DeliveryStage = "Booked" | "Picked Up" | "In Transit" | "Arrived at Destination" | "Out for Delivery" | "Delivered";

interface HistoryEvent {
  status: string;
  title: string;
  description?: string;
  detail?: string;
  location?: string;
  date: Date | string;
  isCurrent: boolean;
  alreadyHappened?: boolean;
}

const STAGES: DeliveryStage[] = ["Booked", "Picked Up", "In Transit", "Arrived at Destination", "Out for Delivery", "Delivered"];

/** Show only parent carrier name (e.g. "dhl pk" → "DHL", "ups_c2s" → "UPS") */
function getParentCarrierName(serviceMode: string | null | undefined): string {
  if (!serviceMode || !String(serviceMode).trim()) return "—";
  const s = String(serviceMode).trim().toLowerCase();
  if (s.startsWith("dhl")) return "DHL";
  if (s.startsWith("ups")) return "UPS";
  if (s.startsWith("fedex") || s.startsWith("fed ex")) return "FedEx";
  if (s.startsWith("skynet") || s.startsWith("SN")) return "Skynet";
  return serviceMode;
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "MMM dd, yyyy 'at' hh:mm a");
  } catch {
    return "—";
  }
}

function formatTimeWithTz(date: Date | string | null | undefined) {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? "+" : "";
    const hours = Math.floor(Math.abs(offsetMin) / 60);
    const mins = Math.abs(offsetMin) % 60;
    const tz = `UTC${sign}${hours}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`;
    return `${format(d, "h:mm a")} (${tz})`;
  } catch {
    return "—";
  }
}

function formatDateHeading(date: Date | string) {
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "EEEE d MMMM yyyy");
  } catch {
    return "—";
  }
}

function formatDateOnly(date: Date | string | null | undefined) {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "d MMMM yyyy");
  } catch {
    return "—";
  }
}

function parseHistory(raw: unknown): TrackingHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is TrackingHistoryEntry =>
      e != null &&
      typeof e === "object" &&
      "status" in e &&
      typeof (e as TrackingHistoryEntry).status === "string" &&
      "timestamp" in e &&
      typeof (e as TrackingHistoryEntry).timestamp === "string"
  );
}

function getActiveStage(status: string): DeliveryStage {
  const s = (status || "").toLowerCase();
  if (s.includes("delivered")) return "Delivered";
  if (s.includes("out for delivery")) return "Out for Delivery";
  if (s.includes("arrived at destination") || s.includes("arrived at")) return "Arrived at Destination";
  if (s.includes("in transit") || s.includes("transit")) return "In Transit";
  if (s.includes("picked up") || s.includes("picked")) return "Picked Up";
  return "Booked";
}

function getEffectiveTrackingStatus(s: Shipment): string {
  const history = parseHistory(s.trackingStatusHistory);
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return sorted[0]?.status ?? s.trackingStatus ?? "Booked";
  }
  return s.trackingStatus ?? "Booked";
}

function getTrackingHistory(s: Shipment): HistoryEvent[] {
  const history = parseHistory(s.trackingStatusHistory);
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const destName = getCountryNameFromCode(s.destination) || s.destination || "";
    const now = Date.now();
    return sorted.map((e, i) => {
      const ts = new Date(e.timestamp).getTime();
      return {
        status: e.status,
        title: e.status,
        description: e.location ? undefined : e.status === "In Transit" && destName ? "En route to " + destName : undefined,
        detail: e.description || (e.status === "In Transit" && !e.location ? "Package in transit" : undefined),
        location: e.location || undefined,
        date: e.timestamp,
        isCurrent: i === sorted.length - 1,
        alreadyHappened: !isNaN(ts) && ts <= now,
      };
    });
  }

  const active = getActiveStage(s.trackingStatus ?? "Booked");
  const bookedDate = typeof s.shipmentDate === "string" ? new Date(s.shipmentDate) : s.shipmentDate;
  const created = typeof s.createdAt === "string" ? new Date(s.createdAt) : s.createdAt;
  const destName = getCountryNameFromCode(s.destination) || s.destination || "destination";

  const laterStages = ["Arrived at Destination", "Out for Delivery", "Delivered"];
  const stages: HistoryEvent[] = [
    {
      status: "In Transit",
      title: "In Transit",
      description: "En route to " + destName,
      detail: "Package in transit",
      date: active === "In Transit" || laterStages.includes(active) ? bookedDate : "",
      isCurrent: active === "In Transit",
    },
    { status: "Picked Up", title: "Picked Up", date: new Date(bookedDate.getTime() - 86400000), isCurrent: false },
    { status: "Booked", title: "Booked", date: created, isCurrent: false },
  ];

  if (laterStages.includes(active)) {
    stages[0].isCurrent = false;
  }
  if (active === "Arrived at Destination" || active === "Out for Delivery" || active === "Delivered") {
    stages.unshift({ status: "Arrived at Destination", title: "Arrived at Destination", detail: "Package arrived at destination country", date: bookedDate, isCurrent: active === "Arrived at Destination" });
  }
  if (active === "Out for Delivery" || active === "Delivered") {
    if (stages[0]?.status === "Arrived at Destination") stages[0].isCurrent = false;
    stages.unshift({ status: "Out for Delivery", title: "Out for Delivery", detail: "Package out for delivery", date: bookedDate, isCurrent: active === "Out for Delivery" });
  }
  if (active === "Delivered") {
    if (stages[0]?.status === "Out for Delivery") stages[0].isCurrent = false;
    stages.unshift({ status: "Delivered", title: "Delivered", date: bookedDate, isCurrent: true });
  }

  const now = Date.now();
  return stages
    .filter((e) => e.date)
    .map((e) => ({
      ...e,
      alreadyHappened: (() => {
        try {
          const t = typeof e.date === "string" ? new Date(e.date).getTime() : (e.date as Date).getTime();
          return !isNaN(t) && t <= now;
        } catch {
          return true;
        }
      })(),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-5);
}

function getHistoryByDateGroups(events: HistoryEvent[]) {
  const byDate = new Map<string, HistoryEvent[]>();
  for (const e of events) {
    const d = typeof e.date === "string" ? new Date(e.date) : e.date;
    const key = format(d, "yyyy-MM-dd");
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }
  for (const arr of byDate.values()) {
    arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return Array.from(byDate.entries())
    .map(([k, evs]) => ({ dateKey: k, dateLabel: formatDateHeading(evs[0]!.date), events: evs }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

function getDimensionsDisplay(s: Shipment): string {
  const rootL = Number(s.length) || 0;
  const rootW = Number(s.width) || 0;
  const rootH = Number(s.height) || 0;
  if (rootL > 0 || rootW > 0 || rootH > 0) return `${rootL} × ${rootW} × ${rootH} cm`;

  let parsed: Array<{ length?: number | string; width?: number | string; height?: number | string }> = [];
  if (s.packages != null) {
    try {
      const raw = typeof s.packages === "string" ? JSON.parse(s.packages) : s.packages;
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      parsed = [];
    }
  }
  if (parsed.length === 0) return "0 × 0 × 0";
  let maxL = 0, maxW = 0, maxH = 0;
  for (const pkg of parsed) {
    const l = typeof pkg.length === "number" ? pkg.length : parseFloat(String(pkg.length || 0)) || 0;
    const w = typeof pkg.width === "number" ? pkg.width : parseFloat(String(pkg.width || 0)) || 0;
    const h = typeof pkg.height === "number" ? pkg.height : parseFloat(String(pkg.height || 0)) || 0;
    if (l > maxL) maxL = l;
    if (w > maxW) maxW = w;
    if (h > maxH) maxH = h;
  }
  return maxL > 0 || maxW > 0 || maxH > 0 ? `${maxL} × ${maxW} × ${maxH} cm` : "0 × 0 × 0";
}

export default function TrackingResultsDialog(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialBookingId?: string;
  autoSearch?: boolean;
  /** When true, renders as page content instead of a dialog */
  asPage?: boolean;
}) {
  const { open = true, onOpenChange, initialBookingId = "", autoSearch = true, asPage = false } = props;
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [recipient, setRecipient] = useState<{ City?: string; Country?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [updatesExpanded, setUpdatesExpanded] = useState(false);

  useEffect(() => {
    if (!asPage && !open) return;
    const q = initialBookingId.trim();
    if (!q) return;
    setBookingId(q);
    if (!autoSearch) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    handleSearch(q);
  }, [asPage, open, initialBookingId, autoSearch]);

  const handleSearch = async (override?: string) => {
    const q = (override ?? bookingId).trim();
    if (!q) {
      toast.error("Please enter a booking ID");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(`/api/shipments?search=${encodeURIComponent(q)}&limit=10`);
      const data = await response.json();
      if (response.ok && data.shipments?.length > 0) {
        const found = data.shipments.find((s: Shipment) => s.invoiceNumber?.toLowerCase() === q.toLowerCase());
        if (found) {
          // If shipment has no tracking history (added before auto-tracking), add Booked + Picked Up
          const history = parseHistory(found.trackingStatusHistory);
          let finalShipment = found;
          if (history.length === 0) {
            try {
              const ensureRes = await fetch(`/api/shipments/${found.id}/ensure-initial-tracking`, {
                method: "POST",
              });
              const ensureData = await ensureRes.json();
              if (ensureRes.ok && ensureData.shipment) {
                finalShipment = ensureData.shipment;
              }
            } catch {
              // keep found
            }
          }
          setShipment(finalShipment);
          // Fetch recipient for destination city
          try {
            const detailRes = await fetch(`/api/shipments/${found.id}`);
            const detailData = await detailRes.json();
            if (detailRes.ok && detailData.recipient) {
              setRecipient(detailData.recipient);
            } else {
              setRecipient(null);
            }
          } catch {
            setRecipient(null);
          }
          toast.success("Shipment found!");
        } else {
          setShipment(null);
          setRecipient(null);
          toast.error("No shipment found with this booking ID");
        }
      } else {
        setShipment(null);
        setRecipient(null);
        toast.error("No shipment found with this booking ID");
      }
    } catch {
      toast.error("An error occurred while searching. Please try again.");
      setShipment(null);
      setRecipient(null);
    } finally {
      setLoading(false);
    }
  };

  const effectiveStatus = shipment ? getEffectiveTrackingStatus(shipment) : "Booked";
  const activeStage = shipment ? getActiveStage(effectiveStatus) : "Booked";
  const historyEvents = shipment ? getTrackingHistory(shipment) : [];
  const activeIndex = STAGES.indexOf(activeStage);
  const countryName = shipment ? (getCountryNameFromCode(shipment.destination) || shipment.destination || "—").toUpperCase() : "—";
  const destLabel = shipment && recipient?.City
    ? `${recipient.City.toUpperCase()}, ${countryName}`
    : countryName;
  const originDisplay = "LAHORE, PAKISTAN";
  const latestEvent = historyEvents.length > 0 ? [...historyEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] : null;
  const statusHeader = (() => {
    const title = latestEvent?.title ?? effectiveStatus;
    const isDelivered = (title || "").toLowerCase().includes("delivered");
    if (isDelivered && destLabel && destLabel !== "—") return `Delivered to ${destLabel}`;
    if (latestEvent?.location) return `${title} at ${latestEvent.location.toUpperCase()}`;
    return title;
  })();
  const statusSubtitle = latestEvent
    ? `${formatDateHeading(latestEvent.date)} at ${formatTimeWithTz(latestEvent.date)}, ${latestEvent.location?.toUpperCase() ?? ""}`.replace(/,\s*$/, "")
    : formatDateTime(shipment?.shipmentDate ?? shipment?.createdAt);

  const slides = useMemo(() => getHistoryByDateGroups(historyEvents), [historyEvents]);

  const content = (
    <>
        {asPage ? (
          <div className="mb-10 pt-8 pb-10 px-4">
            <div className="max-w-xl mx-auto text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3 tracking-tight">
                <span className="bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                  Track Your
                </span>{" "}
                <span className="text-slate-900">Shipment</span>
              </h1>
              <p className="text-slate-500 text-base sm:text-lg mb-8">
                Enter your booking ID to get real-time updates on your shipment
              </p>
              <div className="relative pb-10">
                <div className="rounded-2xl bg-slate-100 border border-slate-200 shadow-sm px-6 pt-9 pb-16 sm:px-8">
                  <div className="flex items-center rounded-xl bg-white border border-slate-300 h-12 overflow-hidden">
                    <Input
                      type="text"
                      placeholder="Enter booking / Shipment ID (e.g., 600001)"
                      value={bookingId}
                      onChange={(e) => setBookingId(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="flex-1 min-w-0 h-full border-0 bg-transparent text-slate-800 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                    />
                  </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 -translate-y-1/4">
                  <button
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className="h-14 px-20 rounded-full bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-base shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center whitespace-nowrap"
                  >
                    {loading ? "Searching..." : (
                      <>
                        Search
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                type="text"
                placeholder="Enter booking ID (e.g., 420001)"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                {loading ? "Searching..." : <><Search className="w-5 h-5 mr-2 inline" />Track</>}
              </Button>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {searched && (
            <motion.div
              key={shipment ? "found" : "not-found"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className={`mt-4 ${asPage ? "text-left" : ""}`}
            >
              {shipment ? (
                <div className="space-y-4">
                  <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <CardContent className="p-6 pt-1 pb-0">
                      <div className="mb-6">
                        <div className="flex flex-row items-center justify-between gap-4">
                          <div className="flex flex-col gap-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              Booking ID: <span className="font-bold text-gray-900 dark:text-white">{shipment.invoiceNumber}</span>
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              This shipment is handled by: <span className="font-bold text-gray-900 dark:text-white">{getParentCarrierName(shipment.serviceMode)}</span>
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => window.print()}
                            className="shrink-0 border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500 dark:text-red-500 dark:hover:bg-red-950/30"
                          >
                            Print
                            <Printer className="w-4 h-4 ml-2" />
                          </Button>
                        </div>

                        <div className="mt-5">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{statusHeader}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{statusSubtitle}</p>
                        </div>
                      </div>

                      <div className="pt-2 pb-1 relative">
                        {/* Connector line: 5 segments between 6 circles */}
                        <div className="absolute left-0 right-0 top-6 h-0.5 flex pointer-events-none px-[8%]" aria-hidden>
                          <div className={`h-full flex-1 ${activeIndex >= 1 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 2 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 3 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 4 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 5 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                        </div>
                        <div className="grid grid-cols-6 gap-0 w-full items-start relative z-10">
                          {STAGES.map((stage, i) => {
                            const done = i < activeIndex;
                            const isCurrent = i === activeIndex;
                            return (
                              <div key={stage} className="flex flex-col items-center min-w-0">
                                <span className="flex shrink-0 items-center justify-center w-8 h-8">
                                  {done ? (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-white">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </span>
                                  ) : isCurrent ? (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500">
                                      <span className="h-2 w-2 rounded-full bg-white" />
                                    </span>
                                  ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800" />
                                  )}
                                </span>
                                <span className={`mt-2 text-center text-xs font-medium whitespace-nowrap ${isCurrent ? "text-blue-600 dark:text-blue-400" : done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`}>
                                  {stage}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-6 text-xs text-gray-800 dark:text-gray-400">
                          <span>Origin: <span className="font-bold">{originDisplay}</span></span>
                          <span>Destination: <span className="font-bold">{destLabel}</span></span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-1">
                    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                      {/* More Shipment Details */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setDetailsExpanded((e) => !e)}
                          className="w-full flex items-center justify-between py-4 px-5 text-left font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <span>More Shipment Details</span>
                          {detailsExpanded ? <ChevronUp className="w-5 h-5 text-red-500 shrink-0" /> : <ChevronDown className="w-5 h-5 text-red-500 shrink-0" />}
                        </button>
                        {detailsExpanded && (
                          <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
                            <dl className="pt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <dt className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">Type</dt>
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{shipment.packaging || "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">Weight</dt>
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                                  {(shipment.totalWeight ?? shipment.weight) != null ? `${Number(shipment.totalWeight ?? shipment.weight).toFixed(2)} kg` : "—"}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">Pcs</dt>
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{shipment.amount != null && shipment.amount > 0 ? shipment.amount : "—"}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">Service Mode</dt>
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{getParentCarrierName(shipment.serviceMode)}</dd>
                              </div>
                              <div>
                                <dt className="text-xs font-semibold text-gray-900 dark:text-white tracking-wide">Tracking No</dt>
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
                                  {shipment.trackingId ? (
                                    getTrackingUrl(shipment) ? (
                                      <a
                                        href={getTrackingUrl(shipment)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        {shipment.trackingId}
                                      </a>
                                    ) : (
                                      shipment.trackingId
                                    )
                                  ) : (
                                    "—"
                                  )}
                                </dd>
                              </div>
                            </dl>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-600" />

                      {/* All Shipment Updates */}
                      <div>
                        <button
                          type="button"
                          onClick={() => setUpdatesExpanded((e) => !e)}
                          className="w-full flex items-center justify-between py-4 px-5 text-left font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <span>All Shipment Updates</span>
                          {updatesExpanded ? <ChevronUp className="w-5 h-5 text-red-500 shrink-0" /> : <ChevronDown className="w-5 h-5 text-red-500 shrink-0" />}
                        </button>
                        {updatesExpanded && (
                          <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
                            <div className="pt-4 w-full overflow-x-auto">
                              {(() => {
                                const allEvents = slides.flatMap((g) => g.events);
                                return (
                                  <>
                                    {/* Event log header */}
                                    <div className="grid grid-cols-4 gap-4 py-2 border-b border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
                                      <div className="min-w-0">Time</div>
                                      <div className="col-span-2 min-w-0">Status Update</div>
                                      <div className="min-w-0">Location</div>
                                    </div>
                                    {/* Event log rows */}
                                    {allEvents.map((event, i) => {
                                      const isDelivered = (event.status || "").toLowerCase().includes("delivered");
                                      return (
                                        <div
                                          key={i}
                                          className="grid grid-cols-4 gap-4 py-4 border-b border-gray-100 dark:border-gray-700/70 last:border-b-0"
                                        >
                                          <div className="flex items-start gap-2 min-w-0">
                                            {isDelivered ? (
                                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 mt-0.5">
                                                <CheckCircle2 className="h-3 w-3 text-white" />
                                              </span>
                                            ) : null}
                                            <div className="min-w-0">
                                              <p className="text-sm text-gray-900 dark:text-white">{formatDateOnly(event.date)}</p>
                                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatTimeWithTz(event.date)}</p>
                                            </div>
                                          </div>
                                          <div className="col-span-2 min-w-0">
                                            {/* <p className={isDelivered ? "text-sm font-semibold text-green-600 dark:text-green-400" : "text-sm font-semibold text-gray-900 dark:text-white"}>
                                              {event.title}
                                            </p> */}
                                            {event.detail ? <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{event.detail}</p> : null}
                                          </div>
                                          <div className="min-w-0">
                                            {event.location ? (
                                              <p className="text-sm text-gray-600 dark:text-gray-400">{event.location}</p>
                                            ) : (
                                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Shipment Found</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      We couldn&apos;t find a shipment with that booking ID. Please check and try again.
                    </p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
    </>
  );

  if (asPage) {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto" size="4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Track Shipment</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

