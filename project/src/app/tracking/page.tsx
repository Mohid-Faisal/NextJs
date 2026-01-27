"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Package, MapPin, Calendar, Search, CheckCircle2, Circle, Route, RotateCw, Info, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCountryNameFromCode } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type TrackingHistoryEntry = { status: string; timestamp: string; description?: string; location?: string };

interface Shipment {
  id: number;
  trackingId: string;
  invoiceNumber: string;
  senderName: string;
  recipientName: string;
  senderAddress?: string;
  recipientAddress?: string;
  destination: string;
  deliveryStatus?: string;
  trackingStatus?: string | null;
  trackingStatusHistory?: TrackingHistoryEntry[] | null;
  invoiceStatus: string;
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
  shippingMode?: string;
  vendor?: string;
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

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const initialBookingId = searchParams.get("bookingId") ?? "";
  const [bookingId, setBookingId] = useState(initialBookingId);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [updatesExpanded, setUpdatesExpanded] = useState(false);

  // When landing with ?bookingId=..., prefill and run search
  useEffect(() => {
    const q = initialBookingId.trim();
    if (!q) return;
    setBookingId(q);
    setSearched(true);
    setLoading(true);
    fetch(`/api/shipments?search=${encodeURIComponent(q)}&limit=10`)
      .then((res) => res.json())
      .then((data: { shipments?: Shipment[] }) => {
        if (data.shipments?.length) {
          const found = data.shipments.find((s) => s.invoiceNumber?.toLowerCase() === q.toLowerCase());
          if (found) {
            setShipment(found);
            toast.success("Shipment found!");
          } else {
            setShipment(null);
            toast.error("No shipment found with this booking ID");
          }
        } else {
          setShipment(null);
          toast.error("No shipment found with this booking ID");
        }
      })
      .catch(() => {
        toast.error("An error occurred while searching. Please try again.");
        setShipment(null);
      })
      .finally(() => setLoading(false));
  }, [initialBookingId]);

  const getActiveStage = (status: string): DeliveryStage => {
    const s = (status || "").toLowerCase();
    if (s.includes("delivered")) return "Delivered";
    if (s.includes("out for delivery")) return "Out for Delivery";
    if (s.includes("in transit") || s.includes("transit")) return "In Transit";
    if (s.includes("picked up") || s.includes("picked")) return "Picked Up";
    return "Booked";
  };

  const getProgressPercent = (stage: DeliveryStage): number => {
    const order: DeliveryStage[] = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];
    const i = order.indexOf(stage);
    return i < 0 ? 0 : ((i + 1) / 5) * 100;
  };

  const parseHistory = (raw: unknown): TrackingHistoryEntry[] => {
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
  };

  const getTrackingHistory = (s: Shipment): HistoryEvent[] => {
    const history = parseHistory(s.trackingStatusHistory);
    if (history.length > 0) {
      const sorted = [...history].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const destName = getCountryNameFromCode(s.destination) || s.destination || "";
      const now = Date.now();
      return sorted.map((e, i) => {
        const ts = new Date(e.timestamp).getTime();
        return {
          status: e.status,
          title: e.status,
          description: e.location
            ? undefined
            : (e.status === "In Transit" && destName)
              ? "En route to " + destName
              : undefined,
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
      {
        status: "Picked Up",
        title: "Picked Up",
        date: new Date(bookedDate.getTime() - 86400000),
        isCurrent: false,
      },
      {
        status: "Booked",
        title: "Booked",
        date: created,
        isCurrent: false,
      },
    ];

    if (active === "Out for Delivery" || active === "Delivered") {
      stages[0].isCurrent = false;
      stages.unshift({
        status: "Out for Delivery",
        title: "Out for Delivery",
        detail: "Package out for delivery",
        date: bookedDate,
        isCurrent: active === "Out for Delivery",
      });
    }
    if (active === "Delivered") {
      const list = stages as HistoryEvent[];
      if (list[0]?.status === "Out for Delivery") list[0].isCurrent = false;
      list.unshift({
        status: "Delivered",
        title: "Delivered",
        date: bookedDate,
        isCurrent: true,
      });
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
  };

  const getEffectiveTrackingStatus = (s: Shipment): string => {
    const history = parseHistory(s.trackingStatusHistory);
    if (history.length > 0) {
      const sorted = [...history].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return sorted[0]?.status ?? s.trackingStatus ?? "Booked";
    }
    return s.trackingStatus ?? "Booked";
  };

  const handleSearch = async () => {
    if (!bookingId.trim()) {
      toast.error("Please enter a booking ID");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(
        `/api/shipments?search=${encodeURIComponent(bookingId.trim())}&limit=10`
      );
      const data = await response.json();
      if (response.ok && data.shipments?.length > 0) {
        const found = data.shipments.find(
          (s: Shipment) => s.invoiceNumber?.toLowerCase() === bookingId.trim().toLowerCase()
        );
        if (found) {
          setShipment(found);
          toast.success("Shipment found!");
        } else {
          setShipment(null);
          toast.error("No shipment found with this booking ID");
        }
      } else {
        setShipment(null);
        toast.error("No shipment found with this booking ID");
      }
    } catch (error) {
      console.error("Error searching shipment:", error);
      toast.error("An error occurred while searching. Please try again.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return format(d, "MMM dd, yyyy 'at' hh:mm a");
    } catch {
      return "—";
    }
  };

  const formatDateShort = (date: Date | string | null | undefined) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return format(d, "MMM dd, yyyy");
    } catch {
      return "—";
    }
  };

  const formatTimeWithTz = (date: Date | string | null | undefined) => {
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
  };

  const formatDateHeading = (date: Date | string) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return format(d, "EEEE d MMMM yyyy");
    } catch {
      return "—";
    }
  };

  const formatDateTimeWithTz = (date: Date | string | null | undefined, location?: string | null) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      const datePart = format(d, "EEEE, d MMMM yyyy");
      const timeTz = formatTimeWithTz(d);
      if (location) return `${datePart} at ${timeTz}, ${location}`;
      return `${datePart} at ${timeTz}`;
    } catch {
      return "—";
    }
  };

  const getHistoryByDateGroups = (events: HistoryEvent[]) => {
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
  };

  const getDimensionsDisplay = (s: Shipment): string => {
    const rootL = Number(s.length) || 0;
    const rootW = Number(s.width) || 0;
    const rootH = Number(s.height) || 0;
    if (rootL > 0 || rootW > 0 || rootH > 0) {
      return `${rootL} × ${rootW} × ${rootH} cm`;
    }
    let parsed: Array<{ length?: number | string; width?: number | string; height?: number | string }> = [];
    if (s.packages != null) {
      try {
        const raw = typeof s.packages === "string" ? JSON.parse(s.packages) : s.packages;
        parsed = Array.isArray(raw) ? raw : [];
      } catch {
        parsed = [];
      }
    }
    if (parsed.length === 0) return "—";
    let maxL = 0, maxW = 0, maxH = 0;
    for (const pkg of parsed) {
      const l = typeof pkg.length === "number" ? pkg.length : parseFloat(String(pkg.length || 0)) || 0;
      const w = typeof pkg.width === "number" ? pkg.width : parseFloat(String(pkg.width || 0)) || 0;
      const h = typeof pkg.height === "number" ? pkg.height : parseFloat(String(pkg.height || 0)) || 0;
      if (l > maxL) maxL = l;
      if (w > maxW) maxW = w;
      if (h > maxH) maxH = h;
    }
    if (maxL > 0 || maxW > 0 || maxH > 0) {
      return `${maxL} × ${maxW} × ${maxH} cm`;
    }
    return "—";
  };

  const STAGES: DeliveryStage[] = ["Booked", "Picked Up", "In Transit", "Out for Delivery", "Delivered"];
  const effectiveStatus = shipment ? getEffectiveTrackingStatus(shipment) : "Booked";
  const activeStage = shipment ? getActiveStage(effectiveStatus) : "Booked";
  const progressPercent = shipment ? getProgressPercent(activeStage) : 0;
  const historyEvents = shipment ? getTrackingHistory(shipment) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <section className="relative bg-linear-to-r from-[#1a365d] to-[#2E7D7D] text-white py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Track Your Package</h1>
            <p className="text-xl opacity-90 mb-8">
              Enter your booking ID to get real-time updates on your shipment
            </p>
            <div className="flex gap-3 max-w-xl mx-auto">
              <Input
                type="text"
                placeholder="Enter booking ID (e.g., 420001)"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-lg bg-white/10 border-white/30 text-white placeholder:text-white/70 focus:bg-white focus:text-gray-900 focus:placeholder:text-gray-500"
              />
              <Button
                onClick={handleSearch}
                disabled={loading}
                size="lg"
                className="px-6 bg-amber-400 hover:bg-amber-500 text-gray-900"
              >
                {loading ? "Searching..." : <><Search className="w-5 h-5 mr-2" /> Track</>}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {searched && (
              <motion.div
                key={shipment ? "found" : "not-found"}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                {shipment ? (
                  <div className="space-y-6">
                    {/* 1. Tracking header */}
                    <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                Booking: {shipment.invoiceNumber}
                              </h2>
                              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                Tracking: {shipment.trackingId}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                                <Calendar className="w-4 h-4 shrink-0" />
                                Booked on {formatDateTime(shipment.shipmentDate ?? shipment.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white">
                              {effectiveStatus}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 2. Stepper (5 stages) + origin–destination */}
                    {(() => {
                      const latestEvent = historyEvents.length > 0
                        ? [...historyEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
                        : null;
                      const sortedByTime = [...historyEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      const originLabel = sortedByTime.find((e) => e.location)?.location ?? "—";
                      const destLabel = (getCountryNameFromCode(shipment.destination) || shipment.destination || "—").toUpperCase();
                      const originDisplay = originLabel !== "—" ? originLabel.toUpperCase() : "—";
                      const statusHeader = latestEvent
                        ? latestEvent.location
                          ? `${latestEvent.title} at ${latestEvent.location.toUpperCase()}`
                          : latestEvent.title
                        : effectiveStatus;
                      const statusSubtitle = latestEvent
                        ? formatDateTimeWithTz(latestEvent.date, latestEvent.location?.toUpperCase())
                        : formatDateTimeWithTz(shipment.shipmentDate ?? shipment.createdAt);
                      const activeIndex = STAGES.indexOf(activeStage);
                      return (
                        <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                          <CardContent className="p-6">
                            <div className="mb-6">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {statusHeader}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {statusSubtitle}
                              </p>
                            </div>
                            <div className="pt-2 pb-8">
                              <div className="flex w-full items-start">
                                {STAGES.map((stage, i) => {
                                  const done = i < activeIndex;
                                  const isCurrent = i === activeIndex;
                                  const isPending = i > activeIndex;
                                  return (
                                    <div key={stage} className="flex-1 flex flex-col items-center min-w-0">
                                      <div className="flex w-full items-center">
                                        {i > 0 && (
                                          <div
                                            className={`flex-1 h-0.5 -mr-0.5 shrink-0 min-w-[8px] ${
                                              i <= activeIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"
                                            }`}
                                          />
                                        )}
                                        <span className="relative z-10 flex shrink-0 items-center justify-center">
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
                                        {i < STAGES.length - 1 && (
                                          <div
                                            className={`flex-1 h-0.5 -ml-0.5 shrink-0 min-w-[8px] ${
                                              i < activeIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-600"
                                            }`}
                                          />
                                        )}
                                      </div>
                                      <span
                                        className={`mt-2 text-center text-xs font-medium ${
                                          isCurrent
                                            ? "text-green-600 dark:text-green-400"
                                            : done
                                              ? "text-gray-700 dark:text-gray-300"
                                              : "text-gray-500 dark:text-gray-400"
                                        }`}
                                      >
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
                      );
                    })()}

                    {/* 3. Accordion: More Shipment Details + All Shipment Updates */}
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
                            {detailsExpanded ? (
                              <ChevronUp className="w-5 h-5 text-red-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-red-500 shrink-0" />
                            )}
                          </button>
                          {detailsExpanded && (
                            <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
                              <dl className="space-y-4 pt-4">
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Destination</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {getCountryNameFromCode(shipment.destination) || shipment.destination || "—"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Service / Ship Mode</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {shipment.serviceMode || "—"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Packaging</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {shipment.packaging || "—"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Weight</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {(shipment.totalWeight ?? shipment.weight) != null
                                      ? `${Number(shipment.totalWeight ?? shipment.weight).toFixed(2)} kg`
                                      : "—"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Dimensions</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {getDimensionsDisplay(shipment)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-sm text-gray-500 dark:text-gray-400">Packages</dt>
                                  <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                                    {shipment.amount != null && shipment.amount > 0 ? shipment.amount : "—"}
                                  </dd>
                                </div>
                              </dl>
                            </div>
                          )}
                        </div>

                        {/* Separator */}
                        <div className="border-t border-gray-200 dark:border-gray-600" />

                        {/* All Shipment Updates */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setUpdatesExpanded((e) => !e)}
                            className="w-full flex items-center justify-between py-4 px-5 text-left font-bold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <span>All Shipment Updates</span>
                            {updatesExpanded ? (
                              <ChevronUp className="w-5 h-5 text-red-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-red-500 shrink-0" />
                            )}
                          </button>
                          {updatesExpanded && (
                            <div className="px-5 pb-5 pt-0 border-t border-gray-100 dark:border-gray-700">
                              <div className="space-y-6 pt-4">
                                {getHistoryByDateGroups(historyEvents).map((group) => (
                                  <div key={group.dateKey} className="relative">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-3">
                                      {group.dateLabel}
                                    </p>
                                    <div className="absolute left-[8.5rem] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-600" aria-hidden />
                                    <ul className="space-y-0">
                                      {group.events.map((event, i) => {
                                        const isDelivered = (event.status || "").toLowerCase().includes("delivered");
                                        return (
                                          <li key={`${group.dateKey}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
                                          <p className="w-28 shrink-0 text-xs text-gray-500 dark:text-gray-400 pt-0.5">
                                            {formatTimeWithTz(event.date)}
                                          </p>
                                          <div className="relative z-10 shrink-0 w-6 flex justify-center pt-0.5">
                                            {isDelivered ? (
                                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                                                <CheckCircle2 className="h-3 w-3 text-white" />
                                              </span>
                                            ) : (
                                              <span className="block h-0 w-0 border-y-[5px] border-y-transparent border-l-[6px] border-l-gray-300 dark:border-l-gray-500" aria-hidden />
                                            )}
                                          </div>
                                          <div className="flex-1 min-w-0 pt-0">
                                            <p className={isDelivered ? "text-sm font-semibold text-green-600 dark:text-green-400" : "text-sm font-semibold text-gray-900 dark:text-white"}>
                                              {event.title}
                                            </p>
                                            {event.location && (
                                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                                {event.location}
                                              </p>
                                            )}
                                            {event.detail && (
                                              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                                {event.detail}
                                              </p>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                    <CardContent className="p-12 text-center">
                      <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        No Shipment Found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                        We couldn&apos;t find a shipment with the booking ID you entered. Please
                        check the ID and try again.
                      </p>
                      <Button
                        onClick={() => setSearched(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Try Again
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!searched && (
            <Card className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <CardContent className="p-6">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Need Help?</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  If you&apos;re having trouble tracking your package, contact our customer support.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" asChild className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                    <a href="/contact">Contact Support</a>
                  </Button>
                  <Button variant="outline" asChild className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950">
                    <a href="tel:+923008482321">Call: +92 300 8482 321</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
