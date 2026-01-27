"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, Calendar, User, Truck, Search, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getCountryNameFromCode } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Shipment {
  id: number;
  trackingId: string;
  invoiceNumber: string;
  senderName: string;
  recipientName: string;
  destination: string;
  deliveryStatus: string;
  invoiceStatus: string;
  shipmentDate: Date | string;
  createdAt: Date | string;
  totalCost?: number;
  weight?: number;
}

interface TrackingStep {
  status: string;
  label: string;
  date?: string;
  completed: boolean;
  active: boolean;
}

export default function TrackingPage() {
  const [trackingId, setTrackingId] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const getTrackingSteps = (status: string): TrackingStep[] => {
    const statusLower = status?.toLowerCase() || "";
    const steps: TrackingStep[] = [
      { status: "pending", label: "Order Placed", completed: true, active: false },
      { status: "processing", label: "Processing", completed: statusLower.includes("processing") || statusLower.includes("in transit") || statusLower.includes("delivered"), active: statusLower.includes("processing") && !statusLower.includes("in transit") && !statusLower.includes("delivered"), date: undefined },
      { status: "in_transit", label: "In Transit", completed: statusLower.includes("in transit") || statusLower.includes("delivered"), active: statusLower.includes("in transit") && !statusLower.includes("delivered"), date: undefined },
      { status: "out_for_delivery", label: "Out for Delivery", completed: statusLower.includes("out for delivery") || statusLower.includes("delivered"), active: statusLower.includes("out for delivery") && !statusLower.includes("delivered"), date: undefined },
      { status: "delivered", label: "Delivered", completed: statusLower.includes("delivered"), active: statusLower.includes("delivered"), date: undefined },
    ];
    return steps;
  };

  const handleSearch = async () => {
    if (!trackingId.trim()) {
      toast.error("Please enter a tracking ID");
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const response = await fetch(`/api/shipments?search=${encodeURIComponent(trackingId.trim())}&limit=1`);
      const data = await response.json();

      if (response.ok && data.shipments && data.shipments.length > 0) {
        const found = data.shipments.find((s: Shipment) => 
          s.trackingId?.toLowerCase() === trackingId.trim().toLowerCase()
        );
        
        if (found) {
          setShipment(found);
          toast.success("Shipment found!");
        } else {
          setShipment(null);
          toast.error("No shipment found with this tracking ID");
        }
      } else {
        setShipment(null);
        toast.error("No shipment found with this tracking ID");
      }
    } catch (error) {
      console.error("Error searching shipment:", error);
      toast.error("An error occurred while searching. Please try again.");
      setShipment(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("delivered")) return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (statusLower.includes("in transit") || statusLower.includes("transit")) return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    if (statusLower.includes("pending") || statusLower.includes("collection")) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Not specified";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return format(d, "MMMM dd, yyyy");
    } catch {
      return "Not specified";
    }
  };

  const trackingSteps = shipment ? getTrackingSteps(shipment.deliveryStatus) : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative bg-gradient-to-r from-[#1a365d] to-[#2E7D7D] text-white py-20"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Track Your Package
            </h1>
            <p className="text-xl opacity-90">
              Enter your tracking ID to get real-time updates on your shipment
            </p>
          </motion.div>
        </div>
      </motion.section>

      {/* Main Content */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Search Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Card className="mb-8 border-0 shadow-xl">
              <CardContent className="p-8">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Enter tracking ID (e.g., PSS123456)"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSearch();
                        }
                      }}
                      className="text-lg border-gray-300 focus:border-[#1a365d] focus:ring-[#1a365d]"
                    />
                  </div>
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    size="lg"
                    className="px-8 bg-[#fbbf24] hover:bg-[#f59e0b] text-white border-0 hover:scale-105 transition-transform"
                  >
                    {loading ? (
                      "Searching..."
                    ) : (
                      <>
                        <Search className="w-5 h-5 mr-2" />
                        Track
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Results Section */}
          <AnimatePresence mode="wait">
            {searched && (
              <motion.div
                key={shipment ? "found" : "not-found"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {shipment ? (
                  <Card className="border-0 shadow-xl">
                    <CardHeader className="bg-gradient-to-r from-[#1a365d] to-[#2E7D7D] text-white rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-2xl">Shipment Details</CardTitle>
                        <Badge className={getStatusColor(shipment.deliveryStatus)}>
                          {shipment.deliveryStatus || "Pending"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      {/* Tracking Progress Bar */}
                      <div className="py-6 border-b">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                          Tracking Progress
                        </h3>
                        <div className="relative">
                          {/* Progress Line */}
                          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ 
                                height: `${(trackingSteps.filter(s => s.completed).length / trackingSteps.length) * 100}%` 
                              }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="absolute top-0 left-0 w-full bg-gradient-to-b from-[#1a365d] to-[#2E7D7D]"
                            />
                          </div>
                          
                          {/* Steps */}
                          <div className="space-y-6">
                            {trackingSteps.map((step, index) => (
                              <motion.div
                                key={step.status}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1, duration: 0.4 }}
                                className="relative flex items-start gap-4"
                              >
                                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${
                                  step.completed 
                                    ? "bg-gradient-to-br from-[#1a365d] to-[#2E7D7D] text-white shadow-lg" 
                                    : step.active
                                    ? "bg-[#fbbf24] text-white shadow-lg animate-pulse"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-400"
                                }`}>
                                  {step.completed ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                  ) : (
                                    <Circle className="w-5 h-5" />
                                  )}
                                </div>
                                <div className="flex-1 pt-2">
                                  <p className={`font-semibold ${
                                    step.completed || step.active
                                      ? "text-gray-900 dark:text-white"
                                      : "text-gray-400 dark:text-gray-500"
                                  }`}>
                                    {step.label}
                                  </p>
                                  {step.date && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                      {step.date}
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Tracking Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="flex items-start gap-3"
                        >
                          <div className="w-10 h-10 bg-[#1a365d]/10 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-[#1a365d]" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tracking ID</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {shipment.trackingId}
                            </p>
                          </div>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="flex items-start gap-3"
                        >
                          <div className="w-10 h-10 bg-[#1a365d]/10 rounded-lg flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[#1a365d]" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Shipment Date</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatDate(shipment.shipmentDate)}
                            </p>
                          </div>
                        </motion.div>
                      </div>

                      {/* Sender & Recipient */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t">
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-5 h-5 text-[#1a365d]" />
                            <h3 className="font-semibold text-gray-900 dark:text-white">Sender</h3>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{shipment.senderName}</p>
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-5 h-5 text-[#1a365d]" />
                            <h3 className="font-semibold text-gray-900 dark:text-white">Recipient</h3>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{shipment.recipientName}</p>
                        </motion.div>
                      </div>

                      {/* Destination */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="pt-6 border-t"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-5 h-5 text-[#1a365d]" />
                          <h3 className="font-semibold text-gray-900 dark:text-white">Destination</h3>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300">
                          {shipment.destination ? getCountryNameFromCode(shipment.destination) : "Not specified"}
                        </p>
                      </motion.div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-xl">
                    <CardContent className="p-12 text-center">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.2 }}
                      >
                        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        No Shipment Found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-6">
                        We couldn't find a shipment with the tracking ID you entered. 
                        Please check the tracking ID and try again.
                      </p>
                      <Button
                        onClick={() => setSearched(false)}
                        className="bg-[#1a365d] hover:bg-[#2c5282] text-white hover:scale-105 transition-transform"
                      >
                        Try Again
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Help Section */}
          {!searched && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="mt-8 border-0 shadow-xl">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                    Need Help?
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    If you're having trouble tracking your package, please contact our customer support team.
                  </p>
                  <div className="flex gap-4">
                    <Button variant="outline" asChild className="border-[#1a365d] text-[#1a365d] hover:bg-[#1a365d] hover:text-white hover:scale-105 transition-transform">
                      <a href="/contact">Contact Support</a>
                    </Button>
                    <Button variant="outline" asChild className="border-[#1a365d] text-[#1a365d] hover:bg-[#1a365d] hover:text-white hover:scale-105 transition-transform">
                      <a href="tel:+923008482321">Call Us: +92 300 8482 321</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
