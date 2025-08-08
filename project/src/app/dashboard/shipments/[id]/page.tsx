"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, User, Truck, DollarSign, ArrowLeft, Package, Building2 } from "lucide-react";
import { Country } from "country-state-city";
import { format } from "date-fns";
import type { Shipment } from "@prisma/client";

export default function ShipmentDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsedPackages, setParsedPackages] = useState<any[]>([]);
  const [packageTotals, setPackageTotals] = useState<any | null>(null);
  const [calcValues, setCalcValues] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/shipments/${id}`);
        const data = await res.json();
        if (res.ok) {
          const s: Shipment = data.shipment;
          setShipment(s);
          try {
            const pkgs = s.packages
              ? typeof s.packages === "string"
                ? JSON.parse(s.packages as unknown as string)
                : (s.packages as any)
              : [];
            setParsedPackages(Array.isArray(pkgs) ? pkgs : []);

            const totals = s.packageTotals
              ? typeof s.packageTotals === "string"
                ? JSON.parse(s.packageTotals as unknown as string)
                : (s.packageTotals as any)
              : null;
            setPackageTotals(totals);

            const calc = s.calculatedValues
              ? typeof s.calculatedValues === "string"
                ? JSON.parse(s.calculatedValues as unknown as string)
                : (s.calculatedValues as any)
              : null;
            setCalcValues(calc);
          } catch (e) {
            console.error("Failed to parse JSON fields", e);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const formatDate = (d?: string | Date | null) => {
    if (!d) return "N/A";
    const date = typeof d === "string" ? new Date(d) : d;
    return format(date, "PPP p");
  };

  const getCountryName = (code?: string | null) => {
    if (!code) return "N/A";
    return (
      Country.getAllCountries().find(c => c.isoCode === code || c.name === code)?.name || code
    );
  };

  const formatMoney = (num?: number | null) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Number(num || 0));

  if (loading) {
    return <div className="p-10">Loading...</div>;
  }

  if (!shipment) {
    return <div className="p-10">Shipment not found.</div>;
  }

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => history.back()} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="text-right">
          <h1 className="text-3xl font-bold">Shipment {shipment.awbNumber}</h1>
          <p className="text-sm text-muted-foreground">Tracking ID: {shipment.trackingId}</p>
        </div>
      </div>

      <Card className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{shipment.serviceMode || "N/A"}</Badge>
                <Badge>{shipment.shippingMode || "N/A"}</Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Created {formatDate(shipment.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{shipment.deliveryStatus || "N/A"}</Badge>
            <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">{shipment.invoiceStatus || "N/A"}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Parties */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><User className="w-5 h-5"/> Sender</h3>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Name:</span> {shipment.senderName}</div>
              <div><span className="font-medium">Address:</span> {shipment.senderAddress}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><User className="w-5 h-5"/> Recipient</h3>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Name:</span> {shipment.recipientName}</div>
              <div><span className="font-medium">Address:</span> {shipment.recipientAddress}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta & Destination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950 dark:to-teal-950 border border-cyan-200 dark:border-cyan-800">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><MapPin className="w-5 h-5"/> Destination</h3>
            <div className="space-y-1 text-sm">
              <div><span className="font-medium">Country:</span> {getCountryName(shipment.destination)}</div>
              <div><span className="font-medium">Delivery Time:</span> {shipment.deliveryTime || "N/A"}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 border border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Building2 className="w-5 h-5"/> Meta</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="font-medium">Agency:</span> {shipment.agency || "N/A"}</div>
              <div><span className="font-medium">Office:</span> {shipment.office || "N/A"}</div>
              <div><span className="font-medium">Vendor:</span> {shipment.vendor || "N/A"}</div>
              <div><span className="font-medium">Service Mode:</span> {shipment.serviceMode || "N/A"}</div>
              <div><span className="font-medium">Shipping Mode:</span> {shipment.shippingMode || "N/A"}</div>
              <div><span className="font-medium">Packaging:</span> {shipment.packaging || "N/A"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charges */}
      <Card className="mt-6 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-950 dark:to-green-950 border border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-5 h-5"/> Charges</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="font-medium">Price / kg:</span> {formatMoney(shipment.price)}</div>
            <div><span className="font-medium">Fuel Surcharge:</span> {formatMoney(shipment.fuelSurcharge)}</div>
            <div><span className="font-medium">Discount %:</span> {shipment.discount ?? 0}%</div>
            <div><span className="font-medium">Insurance %:</span> {shipment.insurance ?? 0}%</div>
            <div><span className="font-medium">Customs %:</span> {shipment.customs ?? 0}%</div>
            <div><span className="font-medium">Tax %:</span> {shipment.tax ?? 0}%</div>
            <div><span className="font-medium">Declared Value %:</span> {shipment.declaredValue ?? 0}%</div>
            <div><span className="font-medium">Reissue:</span> {shipment.reissue ?? 0}</div>
            <div><span className="font-medium">Subtotal:</span> {formatMoney(shipment.subtotal)}</div>
            <div><span className="font-medium">Total:</span> {formatMoney(shipment.totalCost)}</div>
          </div>
          {calcValues && (
            <div className="mt-4 text-sm text-muted-foreground">
              Backend calculation: subtotal {formatMoney(calcValues.subtotal)} | total {formatMoney(calcValues.total)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Packages */}
      <Card className="mt-6 bg-gradient-to-r from-slate-50 to-zinc-50 dark:from-slate-900 dark:to-zinc-900 border border-slate-200 dark:border-slate-800">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Package className="w-5 h-5"/> Packages</h3>
          {parsedPackages.length === 0 ? (
            <div className="text-sm text-muted-foreground">No package details.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-border">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-2 py-1 border">Amount</th>
                    <th className="px-2 py-1 border">Description</th>
                    <th className="px-2 py-1 border">Weight</th>
                    <th className="px-2 py-1 border">L</th>
                    <th className="px-2 py-1 border">W</th>
                    <th className="px-2 py-1 border">H</th>
                    <th className="px-2 py-1 border">Vol. Wt</th>
                    <th className="px-2 py-1 border">Fixed</th>
                    <th className="px-2 py-1 border">DecValue</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPackages.map((p, idx) => (
                    <tr key={idx}>
                      <td className="border px-2 py-1">{p.amount}</td>
                      <td className="border px-2 py-1">{p.packageDescription}</td>
                      <td className="border px-2 py-1">{p.weight}</td>
                      <td className="border px-2 py-1">{p.length}</td>
                      <td className="border px-2 py-1">{p.width}</td>
                      <td className="border px-2 py-1">{p.height}</td>
                      <td className="border px-2 py-1">{p.weightVol}</td>
                      <td className="border px-2 py-1">{p.fixedCharge}</td>
                      <td className="border px-2 py-1">{p.decValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {packageTotals && (
            <div className="mt-3 text-sm">
              <span className="font-medium">Totals:</span> Amount {packageTotals.amount} | Weight {packageTotals.weight} | Vol. Weight {packageTotals.weightVol} | Fixed {packageTotals.fixedCharge} | DecValue {packageTotals.decValue}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


