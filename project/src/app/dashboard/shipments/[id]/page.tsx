"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shipment } from "@prisma/client";
import {
  ArrowLeft,
  MapPin,
  Package,
  DollarSign,
  FileText,
  Printer,
  Edit,
  CreditCard,
  RefreshCw,
  Clock,
  CircleDot,
  Circle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  Scale,
  Layers,
  Truck,
  Building2,
  Tag,
} from "lucide-react";
import { Country } from "country-state-city";
import { format, parseISO } from "date-fns";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type TrackingHistoryEntry = {
  status: string;
  timestamp: string;
  description?: string;
  location?: string;
};

const DELIVERY_STATUSES = [
  "LOST",
  "Pending",
  "Processed",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
  "On Hold",
  "Returned",
  "Awaiting Payment",
];

export default function ShipmentViewPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [recipient, setRecipient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [showPaymentChoiceModal, setShowPaymentChoiceModal] = useState(false);
  const [shipmentInvoices, setShipmentInvoices] = useState<any[]>([]);
  const [trackingHistory, setTrackingHistory] = useState<TrackingHistoryEntry[]>([]);

  useEffect(() => {
    const fetchShipment = async () => {
      try {
        const response = await fetch(`/api/shipments/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setShipment(data.shipment);
          setCustomer(data.customer);
          setRecipient(data.recipient);
        }
      } catch (error) {
        console.error("Error fetching shipment:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchTrackingHistory = async () => {
      try {
        const response = await fetch(`/api/shipments/${params.id}/tracking-status`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.history) {
            setTrackingHistory(data.history);
          }
        }
      } catch (error) {
        console.error("Error fetching tracking history:", error);
      }
    };

    const fetchShipmentInvoices = async () => {
      try {
        const response = await fetch(`/api/accounts/invoices?shipmentId=${params.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.invoices) {
            setShipmentInvoices(data.invoices);
          }
        }
      } catch (error) {
        console.log("Error fetching invoices:", error);
      }
    };

    if (params.id) {
      fetchShipment();
      fetchTrackingHistory();
      fetchShipmentInvoices();
    }
  }, [params.id]);

  const customerInvoice = shipmentInvoices.find(inv => inv.profile === "Customer") || (shipment ? { id: shipment.invoices?.[0]?.id, invoiceNumber: shipment.invoiceNumber } : null);
  const vendorInvoice = shipmentInvoices.find(inv => inv.profile === "Vendor") || (shipment && shipment.invoiceNumber && !isNaN(parseInt(shipment.invoiceNumber)) ? { invoiceNumber: (parseInt(shipment.invoiceNumber) + 2).toString() } : null);
  const airwayBillId = customerInvoice?.id || shipment?.invoices?.[0]?.id;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd/MM/yyyy");
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return "N/A";
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "dd/MM/yyyy, HH:mm:ss");
  };

  const getCountryName = (countryCode?: string | null) => {
    if (!countryCode) return "N/A";
    return Country.getAllCountries().find(c => c.isoCode === countryCode || c.name === countryCode)?.name || countryCode;
  };

  const getStatusBadge = (status: string | null) => {
    const s = status || "Pending";
    switch (s) {
      case "Delivered":
        return "bg-green-100 text-green-700 border-green-200";
      case "In Transit":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "Processed":
      case "Processing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Out for Delivery":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "Cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      case "On Hold":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "Returned":
        return "bg-purple-100 text-purple-700 border-purple-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getInvoiceStatusBadge = (status: string | null) => {
    const s = status || "Unpaid";
    switch (s) {
      case "Paid":
        return "bg-green-100 text-green-700 border-green-200";
      case "Unpaid":
        return "bg-red-100 text-red-700 border-red-200";
      case "Overdue":
        return "bg-orange-100 text-orange-700 border-orange-200";
      case "Partial":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  // Parse packages from JSON
  const packages = useMemo(() => {
    if (!shipment?.packages) return [];
    try {
      const pkgs = typeof shipment.packages === "string" ? JSON.parse(shipment.packages as string) : shipment.packages;
      return Array.isArray(pkgs) ? pkgs : [];
    } catch {
      return [];
    }
  }, [shipment?.packages]);

  // Payment percentage
  const paymentPercentage = useMemo(() => {
    if (!customerInvoice) {
      if (!shipment) return 0;
      if (shipment.invoiceStatus === "Paid") return 100;
      return 0;
    }
    const total = customerInvoice.totalAmount || 0;
    const remaining = customerInvoice.remainingAmount !== undefined ? customerInvoice.remainingAmount : total;
    if (total <= 0) return 0;
    const percentage = Math.round(((total - remaining) / total) * 100);
    return Math.max(0, Math.min(100, percentage));
  }, [customerInvoice, shipment]);

  // Current delivery status
  const currentStatus = shipment?.trackingStatus || shipment?.deliveryStatus || "Pending";

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-3 text-gray-500 text-sm">Loading shipment details...</p>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="w-full min-h-screen bg-gray-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">Shipment not found.</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "details", label: "Details" },
    { key: "payments", label: "Payments" },
    { key: "activity", label: "Activity" },
    { key: "attachments", label: "Attachments" },
  ];

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-zinc-900 px-4 sm:px-6 lg:px-8 py-6">
      {/* Header: Back Button + Tracking ID + Status + Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/shipments")}
            className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
              {shipment.trackingId || `SHP-${shipment.id}`}
            </h1>
            <div>
              <Badge className={`${getStatusBadge(currentStatus)} px-3 py-1 rounded-full text-xs font-semibold border`}>
                {currentStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => window.open(`/dashboard/shipment-invoice/${shipment.id}`, '_blank')}
          >
            <Printer className="w-3.5 h-3.5" />
            Print Label
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => window.open(`/dashboard/shipment-invoice/${shipment.id}`, '_blank')}
          >
            <FileText className="w-3.5 h-3.5" />
            Print Invoice
          </Button>
          {airwayBillId && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => window.open(`/dashboard/receipt/${airwayBillId}`, '_blank')}
            >
              <Printer className="w-3.5 h-3.5" />
              Print Airway Bill
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5 h-9 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            asChild
          >
            <Link href={`/dashboard/update-shipment?id=${shipment.id}`}>
              <Edit className="w-3.5 h-3.5" />
              Edit shipment
            </Link>
          </Button>
          <Button
            size="sm"
            className="text-xs gap-1.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => setShowPaymentChoiceModal(true)}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Register Payment
          </Button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Main Content with Tabs */}
        <div className="flex-1 min-w-0">
          {/* Tab Navigation */}
          <div className="flex items-center justify-center border-b border-gray-200 dark:border-gray-700 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  activeTab === tab.key
                    ? "text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
                    : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Route Details */}
              <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Route Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    {/* Visual Connector Line between columns on md and larger screens */}
                    <div className="hidden md:block absolute left-1/2 top-4 bottom-4 border-l border-dashed border-gray-300 dark:border-zinc-700 -translate-x-1/2"></div>

                    {/* Origin */}
                    <div className="relative border-l-4 border-green-500 pl-4 py-1 bg-green-50/10 dark:bg-green-950/5 rounded-r-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Origin</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-extrabold text-gray-900 dark:text-white">{shipment.senderName}</p>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                          <p className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <span>{customer?.Address || shipment.senderAddress}</span>
                          </p>
                          {customer && (
                            <p className="pl-5 text-gray-500 dark:text-gray-400">
                              {[
                                customer.City,
                                customer.State,
                                customer.Zip,
                                getCountryName(customer.Country)
                              ].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {(customer?.Phone || customer?.Email) && (
                            <div className="pt-2 pl-5 space-y-1 text-xs border-t border-slate-200 dark:border-slate-800/40 mt-2">
                              {customer?.Phone && (
                                <p className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                  <Phone className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{customer.Phone}</span>
                                </p>
                              )}
                              {customer?.Email && (
                                <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{customer.Email}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Destination */}
                    <div className="relative border-l-4 border-indigo-500 pl-4 py-1 bg-indigo-50/10 dark:bg-indigo-950/5 rounded-r-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Destination</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-base font-extrabold text-gray-900 dark:text-white">{shipment.recipientName}</p>
                        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                          <p className="flex items-start gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                            <span>{recipient?.Address || shipment.recipientAddress}</span>
                          </p>
                          <p className="pl-5 text-gray-500 dark:text-gray-400">
                            {recipient ? (
                              [
                                recipient.City,
                                recipient.State,
                                recipient.Zip,
                                getCountryName(recipient.Country)
                              ].filter(Boolean).join(", ")
                            ) : (
                              getCountryName(shipment.destination)
                            )}
                          </p>
                          {(recipient?.Phone || recipient?.Email) && (
                            <div className="pt-2 pl-5 space-y-1 text-xs border-t border-slate-200 dark:border-slate-800/40 mt-2">
                              {recipient?.Phone && (
                                <p className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                  <Phone className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{recipient.Phone}</span>
                                </p>
                              )}
                              {recipient?.Email && (
                                <p className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{recipient.Email}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Package Info */}
              <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Package Info</h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Weight */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Weight</span>
                        <div className="w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Scale className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                        {shipment.totalWeight || shipment.weight || 0} kg
                      </p>
                    </div>

                    {/* Pieces */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Pieces</span>
                        <div className="w-5 h-5 rounded bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                          <Layers className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                        {shipment.amount || 1}
                      </p>
                    </div>

                    {/* Service */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Service</span>
                        <div className="w-5 h-5 rounded bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                          <Truck className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate" title={shipment.serviceMode || shipment.shippingMode || "Standard"}>
                        {shipment.serviceMode || shipment.shippingMode || "Standard"}
                      </p>
                    </div>

                    {/* Vendor */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Vendor</span>
                        <div className="w-5 h-5 rounded bg-violet-50 dark:bg-violet-950/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                          <Building2 className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate" title={shipment.vendor || "N/A"}>
                        {shipment.vendor || "N/A"}
                      </p>
                    </div>

                    {/* Reference No */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Reference No</span>
                        <div className="w-5 h-5 rounded bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight truncate" title={shipment.referenceNumber || "N/A"}>
                        {shipment.referenceNumber || "N/A"}
                      </p>
                    </div>

                    {/* Payment Status */}
                    <div className="bg-slate-50/50 dark:bg-zinc-800/20 border border-slate-100 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Payment</span>
                        <div className="w-5 h-5 rounded bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                          <CreditCard className="w-3 h-3" />
                        </div>
                      </div>
                      <p className="text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                        {shipment.invoiceStatus || "Unpaid"}
                      </p>
                    </div>
                  </div>

                  {shipment.packageDescription && (
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Content Description</p>
                      <p className="text-sm text-gray-900 dark:text-white">{shipment.packageDescription}</p>
                    </div>
                  )}

                  {shipment.declaredValue > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Declared Value</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">USD {shipment.declaredValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Packages Breakdown */}
              {packages.length > 0 && (
                <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                        <Package className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">Packages breakdown</h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Package</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Weight</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Dimensions</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Chargeable weight</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Pieces</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Declared value</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {packages.map((pkg: any, idx: number) => (
                            <tr key={idx} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                              <td className="py-3 px-2 text-gray-900 dark:text-white font-medium">Box {idx + 1}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{pkg.weight || 0} kg</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-gray-300">
                                {pkg.length || 0}×{pkg.width || 0}×{pkg.height || 0} cm
                              </td>
                              <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{pkg.volumetricWeight || pkg.chargeableWeight || 0} kg</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-gray-300">{pkg.quantity || pkg.pieces || 1}</td>
                              <td className="py-3 px-2 text-gray-600 dark:text-gray-300 text-right">USD {(pkg.declaredValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                              <td className="py-3 px-2 text-gray-900 dark:text-white font-semibold text-right">USD {(pkg.total || pkg.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}


            </div>
          )}

          {activeTab === "payments" && (
            <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Payment Records</h3>
                </div>
                <div className="text-center py-12">
                  <CreditCard className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">No payment records found for this shipment.</p>
                  <Button
                    size="sm"
                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                    onClick={() => setShowPaymentChoiceModal(true)}
                  >
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                    Register Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "activity" && (
            <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Activity Log</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Shipment Created</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(shipment.createdAt)}</p>
                    </div>
                  </div>
                  {trackingHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Status Updated To {entry.status}</p>
                        {entry.location && <p className="text-xs text-gray-500 dark:text-gray-400">{entry.location}</p>}
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "attachments" && (
            <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Attachments</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-indigo-600 text-white">
                        <th className="px-4 py-3 text-left font-semibold text-xs rounded-tl-lg">Document</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs">File</th>
                        <th className="px-4 py-3 text-left font-semibold text-xs rounded-tr-lg">Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Shipment Label</td>
                        <td className="px-4 py-3">
                          <a href={`/dashboard/shipment-invoice/${shipment.id}`} target="_blank" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                            {shipment.trackingId}_Label.pdf
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDateTime(shipment.createdAt)}</td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Invoice</td>
                        <td className="px-4 py-3">
                          <a href={`/dashboard/shipment-invoice/${shipment.id}`} target="_blank" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                            Invoice_{shipment.invoiceNumber}.pdf
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDateTime(shipment.createdAt)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="w-full lg:w-[340px] shrink-0 space-y-6">
          {/* Financial Summary */}
          <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Financial Summary</h3>
                </div>
                <Badge className={`${getInvoiceStatusBadge(shipment.invoiceStatus)} px-2.5 py-0.5 rounded text-xs font-semibold border`}>
                  {shipment.invoiceStatus || "Unpaid"}
                </Badge>
              </div>
            </div>
            <CardContent className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">TOTAL</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">USD {shipment.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">BALANCE DUE</span>
                <span className={`text-sm font-bold ${shipment.invoiceStatus === "Paid" || (customerInvoice && customerInvoice.remainingAmount === 0) ? "text-green-600" : "text-red-600"}`}>
                  USD {(customerInvoice && customerInvoice.remainingAmount !== undefined ? customerInvoice.remainingAmount : (shipment.invoiceStatus === "Paid" ? 0 : shipment.totalCost)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-xs text-gray-500 dark:text-gray-400">{paymentPercentage}%</span>
              </div>
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all duration-500 ${paymentPercentage === 100 ? "bg-green-500" : "bg-red-500"}`}
                  style={{ width: `${paymentPercentage}%` }}
                ></div>
              </div>
              <Button
                size="sm"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 gap-1.5"
                onClick={() => setShowPaymentChoiceModal(true)}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Register Payment
              </Button>
            </CardContent>
          </Card>

          {/* Delivery Progress */}
          <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded flex items-center justify-center">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Delivery Progress</h3>
                </div>
                <button className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Change status
                </button>
              </div>
            </div>
            <CardContent className="p-5">
              <div className="space-y-0.5">
                {DELIVERY_STATUSES.map((status) => {
                  const isActive = currentStatus === status;
                  const statusIdx = DELIVERY_STATUSES.indexOf(currentStatus);
                  const thisIdx = DELIVERY_STATUSES.indexOf(status);
                  const isPast = thisIdx < statusIdx && thisIdx >= 1; // After LOST

                  return (
                    <div
                      key={status}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : ""
                      }`}
                    >
                      {isActive ? (
                        <CircleDot className="w-4.5 h-4.5 shrink-0 text-white" />
                      ) : isPast ? (
                        <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-green-500" />
                      ) : (
                        <Circle className="w-4.5 h-4.5 shrink-0 text-gray-300 dark:text-gray-600" />
                      )}
                      <span className={`text-sm ${
                        isActive
                          ? "font-semibold text-white"
                          : isPast
                          ? "text-gray-700 dark:text-gray-300 font-medium"
                          : "text-gray-400 dark:text-gray-500"
                      }`}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Shipment History */}
          {trackingHistory.length > 0 && (
            <Card className="border border-gray-200 dark:border-gray-700 shadow-sm rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 rounded flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Shipment History</h3>
                </div>
              </div>
              <CardContent className="p-5">
                <div className="space-y-5">
                  {[...trackingHistory].reverse().map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${idx === 0 ? "bg-indigo-500" : "bg-orange-400"}`}></div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">Status Updated To {entry.status}</p>
                        {entry.location && <p className="text-xs text-gray-500 dark:text-gray-400">{entry.location}</p>}
                        <p className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(entry.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0 bg-orange-400"></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Shipment Created</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{shipment.senderAddress}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(shipment.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payment Choice Modal */}
      <Dialog open={showPaymentChoiceModal} onOpenChange={setShowPaymentChoiceModal}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">Register Payment</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select which invoice you want to record a payment for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {customerInvoice && (
              <Button
                onClick={() => {
                  setShowPaymentChoiceModal(false);
                  router.push(`/dashboard/income/revenue?invoice=${customerInvoice.invoiceNumber}`);
                }}
                className="w-full justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-left font-medium p-4 h-auto bg-transparent text-gray-900 dark:text-white rounded-xl"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Customer Payment Invoice</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal mt-0.5">Invoice #{customerInvoice.invoiceNumber}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Button>
            )}

            {vendorInvoice && (
              <Button
                onClick={() => {
                  setShowPaymentChoiceModal(false);
                  router.push(`/dashboard/expense/payments?invoice=${vendorInvoice.invoiceNumber}`);
                }}
                className="w-full justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-left font-medium p-4 h-auto bg-transparent text-gray-900 dark:text-white rounded-xl"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Vendor Payment Invoice</span>
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-normal mt-0.5">Invoice #{vendorInvoice.invoiceNumber}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
