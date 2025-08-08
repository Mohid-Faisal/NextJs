"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FaTruck } from "react-icons/fa";
import { ReactNode } from "react";

interface ShippingInfoSectionProps {
  renderSelect: (
    label: string,
    placeholder: string,
    options: string[]
  ) => ReactNode;
  deliveryTimes: string[];
  invoiceStatuses: string[];
  deliveryStatuses: string[];
  shippingModes: string[];
  packagingTypes: string[];
  courierCompanies: string[];
  serviceModes: string[];
}

export default function ShippingInfoSection({
  renderSelect,
  deliveryTimes,
  invoiceStatuses,
  deliveryStatuses,
  shippingModes,
  packagingTypes,
  courierCompanies,
  serviceModes,
}: ShippingInfoSectionProps) {
  return (
    <Card className="bg-white border border-gray-100 shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <FaTruck className="text-primary" />
          <span className="font-medium">Shipping information:</span>
        </div>

        {/* First Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {renderSelect("Delivery Time", "Select delivery time", deliveryTimes)}
          {renderSelect(
            "Invoice Status",
            "Select invoice status",
            invoiceStatuses
          )}
          {renderSelect(
            "Delivery Status",
            "Select delivery status",
            deliveryStatuses
          )}
          {renderSelect("Shipping Mode", "Select shipping mode", shippingModes)}
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {renderSelect(
            "Type of Packaging",
            "Select packaging type",
            packagingTypes
          )}
          {renderSelect(
            "Courier Company",
            "Select courier company",
            courierCompanies
          )}
          {renderSelect("Service Mode", "Select service mode", serviceModes)}
        </div>
      </CardContent>
    </Card>
  );
}
