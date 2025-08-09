"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { label: string; value: string };

export default function AddPaymentPage() {
  const [transactionType, setTransactionType] = useState<"Income" | "Expense" | "Transfer">("Income");
  const [category, setCategory] = useState("Receivable Statement");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState("PKR");
  const [amount, setAmount] = useState(0);
  const [fromAccount, setFromAccount] = useState("Us");
  const [toAccount, setToAccount] = useState("Us");
  const [mode, setMode] = useState("Cash");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [description, setDescription] = useState("");

  const [customerOptions, setCustomerOptions] = useState<Option[]>([]);
  const [vendorOptions, setVendorOptions] = useState<Option[]>([]);

  useEffect(() => {
    const load = async () => {
      const [customersRes, vendorsRes] = await Promise.all([
        fetch(`/api/customers?limit=all`),
        fetch(`/api/vendors?limit=all`),
      ]);
      const customersJson = await customersRes.json();
      const vendorsJson = await vendorsRes.json();
      setCustomerOptions([
        { label: "Us", value: "Us" },
        ...customersJson.customers.map((c: any) => ({ label: c.CompanyName, value: String(c.id) })),
      ]);
      setVendorOptions([
        { label: "Us", value: "Us" },
        ...vendorsJson.vendors.map((v: any) => ({ label: v.CompanyName, value: String(v.id) })),
      ]);
    };
    load();
  }, []);

  const handleSave = async () => {
    const payload: any = {
      transactionType,
      category,
      date: new Date(date).toISOString(),
      currency,
      amount: Number(amount),
      mode,
      reference: reference || undefined,
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      description: description || undefined,
    };

    // Map parties
    payload.fromPartyType = fromAccount === 'Us' ? 'US' : 'CUSTOMER';
    payload.fromCustomerId = fromAccount === 'Us' ? undefined : Number(fromAccount);
    payload.toPartyType = toAccount === 'Us' ? 'US' : 'VENDOR';
    payload.toVendorId = toAccount === 'Us' ? undefined : Number(toAccount);
    const res = await fetch(`/api/accounts/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    try {
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        // @ts-ignore - sonner is global Toaster
        const { toast } = await import("sonner");
        toast.error(json?.message || "Failed to add payment.");
        return;
      }
      const { toast } = await import("sonner");
      toast.success("Payment added successfully.");
      window.location.href = "/dashboard/accounts/payments";
    } catch (e: any) {
      const { toast } = await import("sonner");
      toast.error(e?.message || "Unexpected error.");
    }
  };

  return (
    <div className="p-10 max-w-5xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-3xl font-semibold mb-6">Add Payment</h2>
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-3 text-sm">Transaction Type</div>
            <div className="md:col-span-9 flex gap-6">
              {(["Income", "Expense", "Transfer"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="transactionType"
                    value={t}
                    checked={transactionType === t}
                    onChange={() => setTransactionType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>

            <div className="md:col-span-3 text-sm">Category</div>
            <div className="md:col-span-9">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Receivable Statement">Receivable Statement</SelectItem>
                  <SelectItem value="Payable Statement">Payable Statement</SelectItem>
                  <SelectItem value="Operations Cost">Operations Cost</SelectItem>
                  <SelectItem value="Expenditure (Fixed)">Expenditure (Fixed)</SelectItem>
                  <SelectItem value="Expenditure (Variable)">Expenditure (Variable)</SelectItem>
                  <SelectItem value="Returnable">Returnable</SelectItem>
                  <SelectItem value="Transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 text-sm">Date</div>
            <div className="md:col-span-9">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="md:col-span-3 text-sm">Value</div>
            <div className="md:col-span-2">
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['PKR','USD','EUR','GBP'].map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-7">
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value || '0'))} />
            </div>

            {/* From/To on one line aligned with other fields */}
            <div className="md:col-span-3 text-sm">From Account</div>
            <div className="md:col-span-3">
              <Select value={fromAccount} onValueChange={setFromAccount}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer or Us" />
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 text-sm">To Account</div>
            <div className="md:col-span-3">
              <Select value={toAccount} onValueChange={setToAccount}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select vendor or Us" />
                </SelectTrigger>
                <SelectContent>
                  {vendorOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-3 text-sm">Mode</div>
            <div className="md:col-span-3">
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Cash','Bank Transfer','Card','Cheque'].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Input placeholder="Reference #" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>

            <div className="md:col-span-3 text-sm">Description</div>
            <div className="md:col-span-9">
              <textarea
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent p-2 h-28"
                placeholder="Details"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

          </div>
          <div className="mt-6">
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">Save</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


