"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Package, Truck, DollarSign, FileText, Phone, Building, Globe } from "lucide-react";
import { Country } from "country-state-city";
import { format } from "date-fns";

import type { Shipment } from "@prisma/client";

interface ViewShipmentDialogProps {
  shipment: Shipment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewShipmentDialog({ shipment, open, onOpenChange }: ViewShipmentDialogProps) {
  if (!shipment) return null;

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Not specified";
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "PPP");
  };

  const getCountryName = (countryCode?: string | null) => {
    if (!countryCode) return "Not specified";
    return Country.getAllCountries().find(c => c.isoCode === countryCode || c.name === countryCode)?.name || countryCode;
  };

  const chip = (text: string, variant: "green" | "yellow" | "gray" = "gray") => (
    <span
      className={
        "px-2 py-1 rounded text-xs font-medium " +
        (variant === "green"
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          : variant === "yellow"
          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200")
      }
    >
      {text}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-foreground">Shipment Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header */}
          <Card>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{shipment.awbNumber}</h3>
                  <p className="text-sm text-muted-foreground">Tracking ID: {shipment.trackingId}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {chip(shipment.deliveryStatus || "N/A", "yellow")}
                {chip(shipment.invoiceStatus || "N/A")}
              </div>
            </CardContent>
          </Card>

          {/* Parties */}
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><User className="w-5 h-5"/> Sender</h4>
                <div className="text-sm"><span className="font-medium">Name:</span> {shipment.senderName}</div>
                <div className="text-sm"><span className="font-medium">Address:</span> {shipment.senderAddress}</div>
              </div>
              <div className="space-y-3">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><User className="w-5 h-5"/> Recipient</h4>
                <div className="text-sm"><span className="font-medium">Name:</span> {shipment.recipientName}</div>
                <div className="text-sm"><span className="font-medium">Address:</span> {shipment.recipientAddress}</div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Info */}
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><MapPin className="w-5 h-5"/> Destination</h4>
                <div className="text-sm"><span className="font-medium">Country:</span> {getCountryName(shipment.destination)}</div>
                <div className="text-sm"><span className="font-medium">Delivery Time:</span> {shipment.deliveryTime || "N/A"}</div>
                <div className="text-sm"><span className="font-medium">Service Mode:</span> {shipment.serviceMode || "N/A"}</div>
              </div>
              <div className="space-y-3">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><Calendar className="w-5 h-5"/> Dates</h4>
                <div className="text-sm"><span className="font-medium">Created:</span> {formatDate(shipment.createdAt)}</div>
                <div className="text-sm"><span className="font-medium">Updated:</span> {formatDate(shipment.updatedAt)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Charges */}
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><DollarSign className="w-5 h-5"/> Charges</h4>
                <div className="text-sm"><span className="font-medium">Subtotal:</span> {shipment.subtotal}</div>
                <div className="text-sm"><span className="font-medium">Fuel Surcharge:</span> {shipment.fuelSurcharge}</div>
                <div className="text-sm"><span className="font-medium">Discount:</span> {shipment.discount}%</div>
                <div className="text-sm"><span className="font-medium">Total:</span> {shipment.totalCost}</div>
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package className="w-5 h-5"/> Package</h4>
                <div className="text-sm"><span className="font-medium">Weight:</span> {shipment.weight} kg</div>
                <div className="text-sm"><span className="font-medium">Vol. Weight:</span> {shipment.weightVol}</div>
                <div className="text-sm"><span className="font-medium">Total Packages:</span> {shipment.totalPackages}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}


