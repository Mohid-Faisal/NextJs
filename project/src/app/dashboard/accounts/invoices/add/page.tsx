"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

type Customer = {
  id: number;
  CompanyName: string;
  PersonName: string;
};

type Vendor = {
  id: number;
  CompanyName: string;
  PersonName: string;
};

type Shipment = {
  id: number;
  trackingId: string;
  awbNumber: string;
  destination: string;
  totalWeight: number;
  totalCost: number;
};

type LineItem = {
  description: string;
  value: number;
};

export default function AddInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceId = searchParams.get("id");
  const isEditMode = !!invoiceId;
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    receiptNumber: "",
    trackingNumber: "",
    referenceNumber: "",
    destination: "",
    dayWeek: "",
    weight: "",
    profile: "",
    fscCharges: "0",
    customerId: "",
    vendorId: "",
    shipmentId: "",
    disclaimer: "Any discrepancy in invoice must be notified within 03 days of receipt of this invoice. You are requested to pay the invoice amount through cash payment or cross cheque in favor of \"PSS\" with immediate effect.",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", value: 0 }
  ]);

  useEffect(() => {
    // Fetch customers, vendors and shipments for dropdowns
    const fetchData = async () => {
      try {
        const [customersRes, vendorsRes, shipmentsRes] = await Promise.all([
          fetch("/api/customers?limit=all"),
          fetch("/api/vendors?limit=all"),
          fetch("/api/shipments")
        ]);
        
        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData.customers || []);
        }
        
        if (vendorsRes.ok) {
          const vendorsData = await vendorsRes.json();
          setVendors(vendorsData.vendors || []);
        }
        
        if (shipmentsRes.ok) {
          const shipmentsData = await shipmentsRes.json();
          setShipments(shipmentsData.shipments || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Fetch invoice data when in edit mode
  useEffect(() => {
    const fetchInvoice = async () => {
      if (invoiceId) {
        try {
          const res = await fetch(`/api/accounts/invoices/${invoiceId}`);
          const data = await res.json();
          
          if (data.invoice) {
            const invoice = data.invoice;
            setFormData({
              invoiceNumber: invoice.invoiceNumber || "",
              invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
              receiptNumber: invoice.receiptNumber || "",
              trackingNumber: invoice.trackingNumber || "",
              referenceNumber: invoice.referenceNumber || "",
              destination: invoice.destination || "",
              dayWeek: invoice.dayWeek || "",
              weight: invoice.weight?.toString() || "",
              profile: invoice.customerId ? `customer-${invoice.customerId}` : invoice.vendorId ? `vendor-${invoice.vendorId}` : "",
              fscCharges: invoice.fscCharges?.toString() || "0",
              customerId: invoice.customerId?.toString() || "",
              vendorId: invoice.vendorId?.toString() || "",
              shipmentId: invoice.shipmentId?.toString() || "",
              disclaimer: invoice.disclaimer || "Any discrepancy in invoice must be notified within 03 days of receipt of this invoice. You are requested to pay the invoice amount through cash payment or cross cheque in favor of \"PSS\" with immediate effect.",
            });
            
            if (invoice.lineItems && Array.isArray(invoice.lineItems)) {
              setLineItems(invoice.lineItems);
            }
          }
        } catch (error) {
          console.error("Error fetching invoice:", error);
        }
      }
    };

    fetchInvoice();
  }, [invoiceId]);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", value: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
  };

  const calculateTotal = () => {
    const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.value || 0), 0);
    const fscCharges = parseFloat(formData.fscCharges) || 0;
    return lineItemsTotal + fscCharges;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totalAmount = calculateTotal();
      
      const url = isEditMode 
        ? `/api/accounts/invoices/${invoiceId}`
        : "/api/accounts/invoices";
      
      const method = isEditMode ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          weight: parseFloat(formData.weight),
          fscCharges: parseFloat(formData.fscCharges),
          customerId: formData.customerId || null,
          vendorId: formData.vendorId || null,
          shipmentId: formData.shipmentId || null,
          lineItems,
          totalAmount,
          currency: "USD",
        }),
      });

      if (response.ok) {
        router.push("/dashboard/accounts/invoices");
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} invoice:`, error);
      alert(`Failed to ${isEditMode ? 'update' : 'create'} invoice`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          {isEditMode ? "Edit Invoice" : "Payment Invoice"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {isEditMode ? "Update invoice details" : "Create a new invoice for payment processing"}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-gray-800 dark:text-white">
              {isEditMode ? "Edit Invoice" : "Buying Payment Invoice"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* General Invoice Details Section */}
            <div className="grid grid-cols-8 gap-4">
              <div>
                <Label htmlFor="date" className="font-bold">Date</Label>
                <Input
                  id="date"
                  type="text"
                  value={new Date().toLocaleDateString("en-GB", { 
                    day: "2-digit", 
                    month: "short", 
                    year: "2-digit" 
                  })}
                  readOnly
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="receiptNumber" className="font-bold">Receipt #</Label>
                <Input
                  id="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="trackingNumber" className="font-bold">Tracking #</Label>
                <Input
                  id="trackingNumber"
                  value={formData.trackingNumber}
                  onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="referenceNumber" className="font-bold">Reference #</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="destination" className="font-bold">Destination</Label>
                <Input
                  id="destination"
                  value={formData.destination}
                  onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dayWeek" className="font-bold">D/W</Label>
                <Input
                  id="dayWeek"
                  value={formData.dayWeek}
                  onChange={(e) => setFormData({ ...formData, dayWeek: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="weight" className="font-bold">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Profile and Invoice Specifics Section */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="profile" className="font-bold">Profile</Label>
                <Select
                  value={formData.profile}
                  onValueChange={(value) => {
                    // Parse the value to extract customer/vendor ID and type
                    const [type, id] = value.split('-');
                    if (type === 'customer') {
                      setFormData({ ...formData, profile: value, customerId: id, vendorId: "" });
                    } else if (type === 'vendor') {
                      setFormData({ ...formData, profile: value, vendorId: id, customerId: "" });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select customer or vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                          Customers
                        </div>
                        {customers.map((customer) => (
                          <SelectItem key={`customer-${customer.id}`} value={`customer-${customer.id}`}>
                            {customer.CompanyName} - {customer.PersonName}
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {vendors.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">
                          Vendors
                        </div>
                        {vendors.map((vendor) => (
                          <SelectItem key={`vendor-${vendor.id}`} value={`vendor-${vendor.id}`}>
                            {vendor.CompanyName} - {vendor.PersonName}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="invoiceNumber" className="font-bold">Invoice #</Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invoiceDate" className="font-bold">Invoice Date</Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="shipmentId" className="font-bold">Shipment</Label>
                                 <Select
                   value={formData.shipmentId || "none"}
                   onValueChange={(value) => setFormData({ ...formData, shipmentId: value === "none" ? "" : value })}
                 >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select shipment (optional)" />
                  </SelectTrigger>
                                     <SelectContent>
                     <SelectItem value="none">None</SelectItem>
                     {shipments.map((shipment) => (
                       <SelectItem key={shipment.id} value={shipment.id.toString()}>
                         {shipment.trackingId} - {shipment.destination}
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>
            </div>

            {/* Invoice Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Invoice Line Items</h3>
                <Button
                  type="button"
                  onClick={addLineItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              {lineItems.map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor={`description-${index}`} className="font-bold">Description</Label>
                    <Input
                      id={`description-${index}`}
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`value-${index}`} className="font-bold">Value</Label>
                    <Input
                      id={`value-${index}`}
                      type="number"
                      step="0.01"
                      value={item.value}
                      onChange={(e) => updateLineItem(index, "value", parseFloat(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeLineItem(index)}
                      className="mt-6"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Disclaimer and Financial Service Charge */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <Label htmlFor="disclaimer" className="font-bold">Disclaimer</Label>
                <textarea
                  id="disclaimer"
                  value={formData.disclaimer}
                  onChange={(e) => setFormData({ ...formData, disclaimer: e.target.value })}
                  className="mt-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-700 dark:text-gray-300 w-full h-32 resize-none border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter disclaimer text..."
                />
              </div>
              <div>
                <Label htmlFor="fscCharges" className="font-bold">Fsc (Fuel Surcharge)</Label>
                <Input
                  id="fscCharges"
                  type="number"
                  step="0.01"
                  value={formData.fscCharges}
                  onChange={(e) => setFormData({ ...formData, fscCharges: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Total Calculation */}
            <div className="border-t pt-4">
              <div className="flex justify-end items-center gap-4">
                <div className="text-lg font-semibold text-gray-800 dark:text-white">
                  Total Amount: ${calculateTotal().toLocaleString()}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/accounts/invoices")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update Invoice" : "Create Invoice")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
