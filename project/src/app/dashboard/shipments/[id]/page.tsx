"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shipment } from "@prisma/client";
import { ArrowLeft, Calendar, MapPin, User, Package, Truck, DollarSign, FileText, Building, Download } from "lucide-react";
import { Country } from "country-state-city";
import { format, parseISO } from "date-fns";

export default function ShipmentViewPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShipment = async () => {
      try {
        const response = await fetch(`/api/shipments/${params.id}`);
        if (response.ok) {
          const data = await response.json();
          setShipment(data.shipment);
        } else {
          console.error("Failed to fetch shipment");
        }
      } catch (error) {
        console.error("Error fetching shipment:", error);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchShipment();
    }
  }, [params.id]);

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "Not specified";
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "MMMM dd, yyyy");
  };

  const formatDateTime = (date: Date | string | null | undefined) => {
    if (!date) return "Not specified";
    const d = typeof date === "string" ? parseISO(date) : date;
    return format(d, "yyyy-MM-dd HH:mm a");
  };

  const getCountryName = (countryCode?: string | null) => {
    if (!countryCode) return "Not specified";
    return Country.getAllCountries().find(c => c.isoCode === countryCode || c.name === countryCode)?.name || countryCode;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Delivered":
        return "bg-green-100 text-green-800";
      case "Processing":
        return "bg-blue-100 text-blue-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInvoiceStatusColor = (status: string | null) => {
    switch (status) {
      case "Paid":
        return "bg-teal-500 text-white";
      case "Unpaid":
        return "bg-red-100 text-red-800";
      case "Overdue":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="w-full px-4 md:px-8 py-6 bg-white">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading shipment...</p>
        </div>
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="w-full px-4 md:px-8 py-6 bg-white">
        <div className="text-center py-8">
          <p className="text-gray-600">Shipment not found.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 md:px-8 py-6 bg-white">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Shipments
        </Button>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Main Shipment Details */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8">
            {/* Header with Invoice Number and Actions */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  INVOICE <span className="text-red-600">#{shipment.trackingId}</span>
                </h1>
                <div className="flex items-center gap-4">
                  <Badge className={`${getStatusColor(shipment.deliveryStatus)} px-3 py-1 rounded-full text-sm font-medium`}>
                    Package Status {shipment.deliveryStatus || "Pending_Collection"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge className={`${getInvoiceStatusColor(shipment.invoiceStatus)} px-3 py-1 rounded-full text-sm font-medium`}>
                  Invoice Status {shipment.invoiceStatus || "Unpaid"}
                </Badge>
              </div>
            </div>

            {/* Shipment Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Agency</h3>
                  <p className="text-gray-600">{shipment.agency || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Office</h3>
                  <p className="text-gray-600">{shipment.office || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Shipping Mode</h3>
                  <p className="text-gray-600">{shipment.shippingMode || "Not specified"}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Estimated Delivery Date</h3>
                  <p className="text-gray-600">{formatDate(shipment.shipmentDate)}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Courier Company</h3>
                  <p className="text-gray-600">{shipment.vendor || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Delivery Time</h3>
                  <p className="text-gray-600">{shipment.deliveryTime || "Not specified"}</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Ship Mode</h3>
                  <p className="text-gray-600">{shipment.serviceMode || "Not specified"}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Destination</h3>
                  <p className="text-gray-600">{getCountryName(shipment.destination)}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">Total Cost</h3>
                  <p className="text-gray-600 font-semibold">Rs. {shipment.totalCost}</p>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Sender Information</h3>
                  <div className="space-y-2">
                    <p className="text-gray-600"><span className="font-medium">Name:</span> {shipment.senderName}</p>
                    <p className="text-gray-600"><span className="font-medium">Address:</span> {shipment.senderAddress}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-4">Recipient Information</h3>
                  <div className="space-y-2">
                    <p className="text-gray-600"><span className="font-medium">Name:</span> {shipment.recipientName}</p>
                    <p className="text-gray-600"><span className="font-medium">Address:</span> {shipment.recipientAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Package Details */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4">Package Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Dimensions</h4>
                  <p className="text-gray-600">{shipment.length} × {shipment.width} × {shipment.height} cm</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Weight</h4>
                  <p className="text-gray-600">{shipment.totalWeight || shipment.weight || 0} kg</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Packages</h4>
                  <p className="text-gray-600">{shipment.amount || 1}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Type</h4>
                  <p className="text-gray-600">{shipment.packaging || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Pricing Details */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="font-bold text-gray-900 mb-4">Pricing Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Base Price</h4>
                  <p className="text-gray-600">Rs. {shipment.price}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Discount</h4>
                  <p className="text-gray-600">Rs. {shipment.discount}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Insurance</h4>
                  <p className="text-gray-600">Rs. {shipment.insurance}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Total Cost</h4>
                  <p className="text-gray-900 font-bold text-lg">Rs. {shipment.totalCost}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attachment Details */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-900">Attachment Details</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="px-6 py-3 text-left font-bold">Delivery Details</th>
                    <th className="px-6 py-3 text-left font-bold">File</th>
                    <th className="px-6 py-3 text-left font-bold">Added</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="px-6 py-4 text-gray-600">Shipment Documentation</td>
                    <td className="px-6 py-4">
                      <a href="#" className="text-blue-600 hover:underline flex items-center">
                        <Download className="w-4 h-4 mr-2" />
                        {shipment.trackingId}_{format(new Date(), 'yyyy-MM-dd')}_Shipment_Details.pdf
                      </a>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(shipment.createdAt)}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">Package Label</td>
                    <td className="px-6 py-4">
                      <a href="#" className="text-blue-600 hover:underline flex items-center">
                        <Download className="w-4 h-4 mr-2" />
                        {shipment.trackingId}_Label.pdf
                      </a>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(shipment.createdAt)}</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4 text-gray-600">Invoice</td>
                    <td className="px-6 py-4">
                      <a href="#" className="text-blue-600 hover:underline flex items-center">
                        <Download className="w-4 h-4 mr-2" />
                        Invoice_{shipment.invoiceNumber}.pdf
                      </a>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDateTime(shipment.createdAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
