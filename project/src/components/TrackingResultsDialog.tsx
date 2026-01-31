"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, CheckCircle2, ChevronDown, ChevronUp, Package, Search } from "lucide-react";
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
  packaging?: string;
  amount?: number;
  packages?: unknown;
}

type DeliveryStage = "Booked" | "Picked Up" | "In Transit" | "Out for Delivery" | "Delivered";

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

const STAGES: DeliveryStage[] = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];

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

  const stages: HistoryEvent[] = [
    {
      status: "In Transit",
      title: "In Transit",
      description: "En route to " + destName,
      detail: "Package in transit",
      date: active === "In Transit" || ["Out for Delivery", "Delivered"].includes(active) ? bookedDate : "",
      isCurrent: active === "In Transit",
    },
    { status: "Picked Up", title: "Picked Up", date: new Date(bookedDate.getTime() - 86400000), isCurrent: false },
    { status: "Booked", title: "Booked", date: created, isCurrent: false },
  ];

  if (active === "Out for Delivery" || active === "Delivered") {
    stages[0].isCurrent = false;
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBookingId?: string;
  autoSearch?: boolean;
}) {
  const { open, onOpenChange, initialBookingId = "", autoSearch = true } = props;
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [updatesExpanded, setUpdatesExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const q = initialBookingId.trim();
    if (!q) return;
    setBookingId(q);
    if (!autoSearch) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    handleSearch(q);
  }, [open, initialBookingId, autoSearch]);

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
          if (history.length === 0) {
            try {
              const ensureRes = await fetch(`/api/shipments/${found.id}/ensure-initial-tracking`, {
                method: "POST",
              });
              const ensureData = await ensureRes.json();
              if (ensureRes.ok && ensureData.shipment) {
                setShipment(ensureData.shipment);
              } else {
                setShipment(found);
              }
            } catch {
              setShipment(found);
            }
          } else {
            setShipment(found);
          }
          toast.success("Shipment found!");
        } else {
          setShipment(null);
          toast.error("No shipment found with this booking ID");
        }
      } else {
        setShipment(null);
        toast.error("No shipment found with this booking ID");
      }
    } catch {
      toast.error("An error occurred while searching. Please try again.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const effectiveStatus = shipment ? getEffectiveTrackingStatus(shipment) : "Booked";
  const activeStage = shipment ? getActiveStage(effectiveStatus) : "Booked";
  const historyEvents = shipment ? getTrackingHistory(shipment) : [];
  const activeIndex = STAGES.indexOf(activeStage);
  const destLabel = shipment ? (getCountryNameFromCode(shipment.destination) || shipment.destination || "—").toUpperCase() : "—";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto" size="4xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Track Shipment</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            placeholder="Enter booking ID (e.g., 420001)"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={() => handleSearch()} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? "Searching..." : <><Search className="w-4 h-4 mr-2" />Track</>}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {searched && (
            <motion.div
              key={shipment ? "found" : "not-found"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mt-4"
            >
              {shipment ? (
                <div className="space-y-4">
                  <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <CardContent className="p-6">
                      <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mt-0.5">
                              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">HAWB: {shipment.invoiceNumber}</h2>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <span className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white">
                              {effectiveStatus}
                            </span>
                          </div>
                        </div>

                        <div className="mt-5">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{statusHeader}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{statusSubtitle}</p>
                        </div>
                      </div>

                      <div className="pt-2 pb-6 relative">
                        {/* Connector line behind circles: 4 segments between 5 circles, aligned to grid */}
                        <div className="absolute left-0 right-0 top-6 h-0.5 flex pointer-events-none px-[10%]" aria-hidden>
                          <div className={`h-full flex-1 ${activeIndex >= 1 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 2 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 3 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                          <div className={`h-full flex-1 ${activeIndex >= 4 ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"}`} />
                        </div>
                        <div className="grid grid-cols-5 gap-0 w-full items-start relative z-10">
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
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 ring-4 ring-green-100 dark:ring-green-900/40">
                                      <span className="h-2 w-2 rounded-full bg-white" />
                                    </span>
                                  ) : (
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800" />
                                  )}
                                </span>
                                <span className={`mt-2 text-center text-xs font-medium whitespace-nowrap ${isCurrent ? "text-green-600 dark:text-green-400" : done ? "text-gray-700 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`}>
                                  {stage}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-6 text-xs text-gray-600 dark:text-gray-400">
                          <span>Origin: {originDisplay}</span>
                          <span>Destination: {destLabel}</span>
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
                                <dd className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{shipment.serviceMode || "—"}</dd>
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
                                            <p className={isDelivered ? "text-sm font-semibold text-green-600 dark:text-green-400" : "text-sm font-semibold text-gray-900 dark:text-white"}>
                                              {event.title}
                                            </p>
                                            {event.detail ? <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.detail}</p> : null}
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
      </DialogContent>
    </Dialog>
  );
}

