'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, ArrowLeft, Plus, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface InvoiceData {
  id: number;
  invoiceNumber: string;
  createdAt: string;
  referenceNumber?: string;
  totalAmount: number;
  fscCharges: number;
  discount: number;
  shipment?: {
    id: number;
    trackingId?: string;
    destination?: string;
    dayWeek?: boolean;
    packages?: string;
    calculatedValues?: string;
  };
  customer?: {
    id: number;
    CompanyName?: string;
    PersonName?: string;
    Address?: string;
    City?: string;
    Country?: string;
  };
  vendor?: {
    id: number;
    CompanyName?: string;
    name?: string;
    PersonName?: string;
    contactPerson?: string;
    Address?: string;
    address?: string;
    City?: string;
    city?: string;
    Country?: string;
    country?: string;
  };
}

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [calculatedValues, setCalculatedValues] = useState<any>({});
  const [disclaimer, setDisclaimer] = useState('Any discrepancy in invoice must be notified within 03 days of receipt of this invoice. You are requested to pay the invoice amount through cash payment or cross cheque in favor of PSS with immediate effect.');
  const [note, setNote] = useState('No cash, Cash equivalent, Gold jewelary or Dangerous goods accepted. Insurance is compulsory from shipper side, PSS is notresponsible for any loss and damage goods.');
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchInvoiceData();
    }
  }, [params.id]);

  // Update line items when calculatedValues change
  useEffect(() => {
    if (calculatedValues.total && lineItems.length > 0 && lineItems[0].value === 0) {
      const updatedLineItems = [...lineItems];
      updatedLineItems[0] = { ...updatedLineItems[0], value: calculatedValues.total };
      setLineItems(updatedLineItems);
    }
  }, [calculatedValues]);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      // Get invID from URL search params
      const urlParams = new URLSearchParams(window.location.search);
      const invID = urlParams.get('invID');
      
      if (!invID) {
        console.error('Invoice ID not found in URL parameters');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/accounts/invoices/${params.id}/edit?invID=${invID}`);
      if (response.ok) {
        const data = await response.json();
        setInvoiceData(data);
        
        // Parse calculated values first
        let parsedValues: any = {};
        if (data.shipment?.calculatedValues) {
          try {
            parsedValues = JSON.parse(data.shipment.calculatedValues);
            setCalculatedValues(parsedValues);
          } catch (e) {
            console.error('Error parsing calculated values:', e);
          }
        }
        
        // Parse packages
        if (data.shipment?.packages) {
          try {
            const parsedPackages = typeof data.shipment.packages === 'string' 
              ? JSON.parse(data.shipment.packages) 
              : data.shipment.packages;
            setPackages(parsedPackages);
          } catch (e) {
            console.error('Error parsing packages:', e);
          }
        }

        // Initialize line items - prefer invoice lineItems, fallback to packages or calculated values
        if (data.lineItems && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
          // Use existing line items from invoice, but filter out "Fuel Surcharge" and "Discount"
          // since they're already separate fields (fscCharges and discount)
          const invoiceLineItems = data.lineItems
            .filter((item: any) => 
              item.description !== "Fuel Surcharge" && 
              item.description !== "Discount"
            )
            .map((item: any, index: number) => ({
              id: item.id || (index + 1).toString(),
              description: item.description || '',
              value: item.value || 0
            }));
          setLineItems(invoiceLineItems);
        } else if (data.shipment?.packages) {
          try {
            const parsedPackages = typeof data.shipment.packages === 'string' 
              ? JSON.parse(data.shipment.packages) 
              : data.shipment.packages;
            // Initialize line items from packages
            const initialLineItems = parsedPackages.map((pkg: any, index: number) => ({
              id: pkg.id || (index + 1).toString(),
              description: pkg.packageDescription || '',
              value: pkg.value || parsedValues.total || 0
            }));
            setLineItems(initialLineItems);
          } catch (e) {
            console.error('Error parsing packages for line items:', e);
            // Initialize with line item using calculated values if parsing fails
            setLineItems([{ id: '1', description: '', value: parsedValues.total || data.totalAmount || 0 }]);
          }
        } else {
          // Initialize with line item using calculated values or totalAmount
          setLineItems([{ id: '1', description: '', value: parsedValues.total || data.totalAmount || 0 }]);
        }

        // Set disclaimer if available
        if (data.disclaimer) {
          setDisclaimer(data.disclaimer);
        }
      } else {
        console.error('Failed to fetch invoice data');
      }
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!invoiceData) return;

    setUpdating(true);
    try {
      const invID = invoiceData.id;
      const shipmentId = invoiceData.shipment?.id || params.id;

      // Calculate total amount from line items, FSC charges, and discount
      const lineItemsTotal = lineItems.reduce((sum, item) => sum + (item.value || 0), 0);
      const fscCharges = invoiceData.fscCharges || 0;
      const discount = invoiceData.discount || 0;
      const totalAmount = lineItemsTotal + fscCharges - discount;

      // Update calculatedValues with new total
      const updatedCalculatedValues = {
        ...calculatedValues,
        subtotal: lineItemsTotal,
        total: totalAmount,
      };

      // Prepare update data
      const updateData = {
        invoiceNumber: invoiceData.invoiceNumber,
        totalAmount: totalAmount,
        fscCharges: fscCharges,
        discount: discount,
        lineItems: lineItems,
        disclaimer: disclaimer,
        shipment: {
          id: parseInt(shipmentId as string),
          trackingId: invoiceData.shipment?.trackingId || '',
          destination: invoiceData.shipment?.destination || '',
          dayWeek: invoiceData.shipment?.dayWeek || false,
          packages: packages,
          calculatedValues: updatedCalculatedValues,
        },
        referenceNumber: invoiceData.referenceNumber || '',
      };

      // Call the update API
      const response = await fetch(`/api/accounts/invoices/${shipmentId}/edit?invID=${invID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('Invoice updated successfully!');
        // Refresh the invoice data to get the latest values
        await fetchInvoiceData();
      } else {
        toast.error(`Error updating invoice: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('Failed to update invoice. Please try again.');
    } finally {
      setUpdating(false);
    }
  };


  const handlePrint = () => {
    if (invoiceData) {
      const invID = invoiceData.id;
      const shipmentId = invoiceData.shipment?.id || params.id;
      
      // Use lineItems directly
      const finalLineItems = lineItems.length > 0 ? lineItems : [{
        description: 'Service Item',
        value: 0
      }];
      
      // Calculate total amount
      const lineItemsTotal = finalLineItems.reduce((sum, item) => sum + (item.value || 0), 0);
      const fscCharges = invoiceData.fscCharges || 0;
      const discount = invoiceData.discount || 0;
      const totalAmount = lineItemsTotal + fscCharges - discount;
      
      // Create the updated invoice data
      const updatedInvoiceData = {
        ...invoiceData,
        lineItems: finalLineItems,
        totalAmount: totalAmount,
        disclaimer: disclaimer,
        note: note,
        shipment: {
          ...invoiceData.shipment,
          packages: packages,
          calculatedValues: calculatedValues,
        }
      };
      
      // Open invoice with updated data for printing with print parameter
      const queryParams = new URLSearchParams({
        invID: invID.toString(),
        data: JSON.stringify(updatedInvoiceData),
        print: 'true'
      });
      
      window.open(`/api/accounts/invoices/${shipmentId}/invoice?${queryParams.toString()}`, '_blank');
    }
  };

  const updatePackage = (index: number, field: string, value: any) => {
    const updatedPackages = [...packages];
    updatedPackages[index] = { ...updatedPackages[index], [field]: value };
    setPackages(updatedPackages);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, {
      id: (lineItems.length + 1).toString(),
      description: '',
      value: 0
    }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
  };

  const addPackage = () => {
    setPackages([...packages, {
      id: (packages.length + 1).toString(),
      packageDescription: '',
      weight: 0,
      length: 0,
      width: 0,
      height: 0,
      amount: 1
    }]);
  };

  const removePackage = (index: number) => {
    setPackages(packages.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Invoice not found</h1>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const isVendor = !!invoiceData.vendor;

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Edit Invoice
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Update invoice details
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center text-gray-800 dark:text-white">
              Buying Payment Invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* General Invoice Details Section */}
            <div className="grid grid-cols-7 gap-4">
              <div>
                <Label htmlFor="date" className="font-bold">
                  Date
                </Label>
                <Input
                  id="date"
                  type="text"
                  value={new Date(invoiceData.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                  })}
                  readOnly
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="receiptNumber" className="font-bold">
                  Receipt #
                </Label>
                <Input
                  id="receiptNumber"
                  value={invoiceData.shipment?.trackingId || ''}
                  onChange={(e) => setInvoiceData({
                    ...invoiceData,
                    shipment: {...invoiceData.shipment!, trackingId: e.target.value}
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="trackingNumber" className="font-bold">
                  Tracking #
                </Label>
                <Input
                  id="trackingNumber"
                  value={invoiceData.shipment?.trackingId || ''}
                  onChange={(e) => setInvoiceData({
                    ...invoiceData,
                    shipment: {...invoiceData.shipment!, trackingId: e.target.value}
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="destination" className="font-bold">
                  Destination
                </Label>
                <Input
                  id="destination"
                  value={invoiceData.shipment?.destination || ''}
                  onChange={(e) => setInvoiceData({
                    ...invoiceData,
                    shipment: {...invoiceData.shipment!, destination: e.target.value}
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dayWeek" className="font-bold">
                  D/W
                </Label>
                <Input
                  id="dayWeek"
                  value={invoiceData.shipment?.dayWeek ? 'D' : 'W'}
                  onChange={(e) => setInvoiceData({
                    ...invoiceData,
                    shipment: {...invoiceData.shipment!, dayWeek: e.target.value === 'D'}
                  })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="weight" className="font-bold">
                  Weight
                </Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  value={packages.length > 0 ? packages[0].weight || 0 : 0}
                  onChange={(e) => {
                    if (packages.length > 0) {
                      updatePackage(0, 'weight', parseFloat(e.target.value) || 0);
                    }
                  }}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Profile and Invoice Specifics Section */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label htmlFor="profile" className="font-bold">
                  Profile
                </Label>
                <Input
                  id="profile"
                  value={isVendor ? 'Vendor' : 'Customer'}
                  readOnly
                  className="mt-1 bg-gray-50"
                />
              </div>
              <div>
                <Label htmlFor="invoiceNumber" className="font-bold">
                  Invoice #
                </Label>
                <Input
                  id="invoiceNumber"
                  value={invoiceData.invoiceNumber}
                  onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invoiceDate" className="font-bold">
                  Invoice Date
                </Label>
                <Input
                  id="invoiceDate"
                  type="date"
                  value={new Date(invoiceData.createdAt).toISOString().split('T')[0]}
                  onChange={(e) => setInvoiceData({...invoiceData, createdAt: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Invoice Line Items Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Invoice Line Items
                </h3>
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
                    <Label
                      htmlFor={`description-${index}`}
                      className="font-bold"
                    >
                      Description
                    </Label>
                    <Input
                      id={`description-${index}`}
                      value={item.description || ''}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`value-${index}`} className="font-bold">
                      Value
                    </Label>
                    <Input
                      id={`value-${index}`}
                      type="number"
                      step="0.01"
                      value={item.value || 0}
                      onChange={(e) => updateLineItem(index, 'value', parseFloat(e.target.value) || 0)}
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
                <Label htmlFor="disclaimer" className="font-bold">
                  Disclaimer
                </Label>
                <Textarea
                  id="disclaimer"
                  value={disclaimer}
                  onChange={(e) => setDisclaimer(e.target.value)}
                  className="mt-2 h-32 resize-none"
                  placeholder="Enter disclaimer text..."
                />
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fscCharges" className="font-bold">
                    Fsc (Fuel Surcharge)
                  </Label>
                  <Input
                    id="fscCharges"
                    type="number"
                    step="0.01"
                    value={invoiceData.fscCharges}
                    onChange={(e) => setInvoiceData({...invoiceData, fscCharges: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="discount" className="font-bold">
                    Discount
                  </Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    value={invoiceData.discount || 0}
                    onChange={(e) => setInvoiceData({...invoiceData, discount: parseFloat(e.target.value) || 0})}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Note Section */}
            <div>
              <Label htmlFor="note" className="font-bold">
                Note
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 h-24 resize-none"
                placeholder="Enter any additional notes..."
              />
            </div>

            {/* Total Calculation */}
            <div className="border-t pt-4">
              <div className="flex justify-end items-center gap-4">
                <div className="text-lg font-semibold text-gray-800 dark:text-white">
                  Total Amount: PKR {(lineItems.reduce((sum, item) => sum + (item.value || 0), 0) + (invoiceData.fscCharges || 0) - (invoiceData.discount || 0)).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {updating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Invoice
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
