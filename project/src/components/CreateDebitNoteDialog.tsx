"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, X, Info, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Bill = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  currency: string;
  vendor: {
    id: number;
    PersonName: string;
    CompanyName: string;
  };
};

type Vendor = {
  id: number;
  PersonName: string;
  CompanyName: string;
};

type Account = {
  id: number;
  code: string;
  accountName: string;
  category: string;
};

interface CreateDebitNoteDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateDebitNoteDialog({
  onClose,
  onSuccess,
}: CreateDebitNoteDialogProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedBill, setSelectedBill] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [entryType, setEntryType] = useState<"DEBIT" | "CREDIT">("DEBIT");
  const [debitAccountId, setDebitAccountId] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string>("");
  const [billSearchTerm, setBillSearchTerm] = useState<string>("");
  const [isBillSelectOpen, setIsBillSelectOpen] = useState<boolean>(false);
  const billSearchInputRef = useRef<HTMLInputElement>(null);

  // Fetch available bills, vendors, and accounts
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch("/api/debit-notes/bills");
        const data = await res.json();
        setBills(data.bills);
      } catch (error) {
        console.error("Error fetching bills:", error);
      }
    };

    const fetchVendors = async () => {
      try {
        const res = await fetch("/api/vendors");
        const data = await res.json();
        setVendors(data.vendors || []);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      }
    };

    const fetchAccounts = async () => {
      try {
        const res = await fetch("/api/chart-of-accounts?limit=1000");
        const data = await res.json();
        if (data.success && data.data) {
          setAccounts(data.data);
        }
      } catch (error) {
        console.error("Error fetching accounts:", error);
      }
    };

    fetchBills();
    fetchVendors();
    fetchAccounts();
  }, []);

  // Auto-fill vendor when bill is selected
  useEffect(() => {
    if (selectedBill) {
      const bill = bills.find(b => b.id.toString() === selectedBill);
      if (bill) {
        setSelectedVendor(bill.vendor.id.toString());
        setAmount(bill.totalAmount.toString());
      }
    }
  }, [selectedBill, bills]);

  // Focus search input when select opens
  useEffect(() => {
    if (isBillSelectOpen && billSearchInputRef.current) {
      setTimeout(() => {
        billSearchInputRef.current?.focus();
      }, 100);
    }
  }, [isBillSelectOpen]);

  // Automatically set accounts based on entry type
  useEffect(() => {
    if (accounts.length > 0) {
      if (entryType === "CREDIT") {
        // CREDIT type: Debit Vendor Expense, Credit Cash
        const vendorExpenseAccount = accounts.find(acc => 
          acc.category === "Expense" && acc.accountName.toLowerCase().includes("vendor")
        ) || accounts.find(acc => acc.category === "Expense");
        const cashAccount = accounts.find(acc => 
          acc.category === "Asset" && acc.accountName.toLowerCase().includes("cash")
        );
        
        if (vendorExpenseAccount) setDebitAccountId(vendorExpenseAccount.id.toString());
        if (cashAccount) setCreditAccountId(cashAccount.id.toString());
      } else {
        // DEBIT type: Debit Cash, Credit Other Revenue
        const cashAccount = accounts.find(acc => 
          acc.category === "Asset" && acc.accountName.toLowerCase().includes("cash")
        );
        const otherRevenueAccount = accounts.find(acc => 
          acc.category === "Revenue" && acc.accountName.toLowerCase().includes("other revenue")
        ) || accounts.find(acc => acc.category === "Revenue");
        
        if (cashAccount) setDebitAccountId(cashAccount.id.toString());
        if (otherRevenueAccount) setCreditAccountId(otherRevenueAccount.id.toString());
      }
    }
  }, [entryType, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor || !amount || !date || !debitAccountId || !creditAccountId) {
      alert("Please fill in all required fields including account selections");
      return;
    }

    setIsLoading(true);

    try {
      const parsed = parseFloat(amount);
      const numericAmount = Math.abs(parsed);
      const typePrefix = entryType === "DEBIT" ? "Debit Note" : "Credit Note";
      const prefixedDescription = description
        ? `${typePrefix}: ${description}`
        : typePrefix;
      const response = await fetch("/api/debit-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billId: selectedBill || null,
          vendorId: selectedVendor,
          amount: numericAmount,
          date,
          description: prefixedDescription,
          type: entryType,
          debitAccountId: parseInt(debitAccountId),
          creditAccountId: parseInt(creditAccountId),
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create debit note");
      }
    } catch (error) {
      console.error("Error creating debit note:", error);
      alert("Failed to create debit note");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Create New Debit Note
        </h2>
        {/* <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button> */}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bill Selection */}
        <div className="space-y-2">
          <Label htmlFor="bill" className="text-sm font-medium">
            Bill <span className="text-red-500">*</span>
          </Label>
          <Select 
            value={selectedBill} 
            onValueChange={(value) => {
              setSelectedBill(value);
              setIsBillSelectOpen(false);
              setBillSearchTerm("");
            }}
            open={isBillSelectOpen}
            onOpenChange={setIsBillSelectOpen}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Bill" />
            </SelectTrigger>
            <SelectContent>
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    ref={billSearchInputRef}
                    type="text"
                    placeholder="Search by invoice number or vendor name..."
                    value={billSearchTerm}
                    onChange={(e) => setBillSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {bills
                  .filter((bill) => {
                    if (!billSearchTerm) return true;
                    const searchLower = billSearchTerm.toLowerCase();
                    const invoiceNumber = bill.invoiceNumber.toLowerCase();
                    const vendorName = (bill.vendor.PersonName || bill.vendor.CompanyName || "").toLowerCase();
                    return invoiceNumber.includes(searchLower) || vendorName.includes(searchLower);
                  })
                  .map((bill) => (
                    <SelectItem key={bill.id} value={bill.id.toString()}>
                      {bill.invoiceNumber} - {bill.vendor.PersonName || bill.vendor.CompanyName} 
                      ({bill.currency} {bill.totalAmount.toLocaleString()})
                    </SelectItem>
                  ))}
                {bills.filter((bill) => {
                  if (!billSearchTerm) return false;
                  const searchLower = billSearchTerm.toLowerCase();
                  const invoiceNumber = bill.invoiceNumber.toLowerCase();
                  const vendorName = (bill.vendor.PersonName || bill.vendor.CompanyName || "").toLowerCase();
                  return invoiceNumber.includes(searchLower) || vendorName.includes(searchLower);
                }).length === 0 && (
                  <div className="px-2 py-6 text-center text-sm text-gray-500">
                    No bills found
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-sm font-medium">
            Amount <span className="text-red-500">*</span>
          </Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            placeholder="Enter Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        {/* Date + Type (one line) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="text-sm font-medium">
              Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="date"
                type="date"
                placeholder="dd/mm/yyyy"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10"
                required
              />
              <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Type (DEBIT/CREDIT) */}
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">
              Type <span className="text-red-500">*</span>
            </Label>
            <Select value={entryType} onValueChange={(v) => setEntryType(v as "DEBIT" | "CREDIT")}>
              <SelectTrigger id="type" className="w-full h-10">
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEBIT">DEBIT</SelectItem>
                <SelectItem value="CREDIT">CREDIT</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Description
          </Label>
          <Textarea
            id="description"
            placeholder="Enter Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {/* Account Selection */}
        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
              Select Accounts:
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="debitAccount" className="text-sm font-medium">
                Debit Account <span className="text-red-500">*</span>
              </Label>
              <Select value={debitAccountId} onValueChange={setDebitAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Debit Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.code} - {account.accountName} ({account.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditAccount" className="text-sm font-medium">
                Credit Account <span className="text-red-500">*</span>
              </Label>
              <Select value={creditAccountId} onValueChange={setCreditAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Credit Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.code} - {account.accountName} ({account.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 bg-orange-500 hover:bg-orange-700"
          >
            {isLoading ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
