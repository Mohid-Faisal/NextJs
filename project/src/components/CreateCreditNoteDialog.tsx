"use client";

import { useState, useEffect } from "react";
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
import { Calendar, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Invoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  currency: string;
  customer: {
    id: number;
    PersonName: string;
    CompanyName: string;
  };
};

type Customer = {
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

interface CreateCreditNoteDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCreditNoteDialog({
  onClose,
  onSuccess,
}: CreateCreditNoteDialogProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [entryType, setEntryType] = useState<"DEBIT" | "CREDIT">("CREDIT");
  const [debitAccountId, setDebitAccountId] = useState<string>("");
  const [creditAccountId, setCreditAccountId] = useState<string>("");

  // Fetch available invoices, customers, and accounts
  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch("/api/credit-notes/invoices");
        const data = await res.json();
        setInvoices(data.invoices);
      } catch (error) {
        console.error("Error fetching invoices:", error);
      }
    };

    const fetchCustomers = async () => {
      try {
        const res = await fetch("/api/customers");
        const data = await res.json();
        setCustomers(data.customers || []);
      } catch (error) {
        console.error("Error fetching customers:", error);
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

    fetchInvoices();
    fetchCustomers();
    fetchAccounts();
  }, []);

  // Auto-fill customer when invoice is selected
  useEffect(() => {
    if (selectedInvoice) {
      const invoice = invoices.find(i => i.invoiceNumber === selectedInvoice);
      if (invoice) {
        setSelectedCustomer(invoice.customer.id.toString());
        setAmount(invoice.totalAmount.toString());
      }
    }
  }, [selectedInvoice, invoices]);

  // Automatically set accounts based on entry type
  useEffect(() => {
    if (accounts.length > 0) {
      if (entryType === "CREDIT") {
        // CREDIT type: Debit Cash, Credit Logistics Revenue
        const cashAccount = accounts.find(acc => 
          acc.category === "Asset" && acc.accountName.toLowerCase().includes("cash")
        );
        const revenueAccount = accounts.find(acc => 
          acc.category === "Revenue" && acc.accountName.toLowerCase().includes("logistic")
        ) || accounts.find(acc => acc.category === "Revenue");
        
        if (cashAccount) setDebitAccountId(cashAccount.id.toString());
        if (revenueAccount) setCreditAccountId(revenueAccount.id.toString());
      } else {
        // DEBIT type: Debit Misc Expense, Credit Cash
        const expenseAccount = accounts.find(acc => 
          acc.category === "Expense" && (
            acc.accountName.toLowerCase().includes("misc") ||
            acc.accountName.toLowerCase().includes("other expense")
          )
        ) || accounts.find(acc => acc.category === "Expense");
        const cashAccount = accounts.find(acc => 
          acc.category === "Asset" && acc.accountName.toLowerCase().includes("cash")
        );
        
        if (expenseAccount) setDebitAccountId(expenseAccount.id.toString());
        if (cashAccount) setCreditAccountId(cashAccount.id.toString());
      }
    }
  }, [entryType, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCustomer || !amount || !date || !debitAccountId || !creditAccountId) {
      alert("Please fill in all required fields including account selections");
      return;
    }

    setIsLoading(true);

    try {
      const typePrefix = entryType === "DEBIT" ? "Debit Note" : "Credit Note";
      const prefixedDescription = description
        ? `${typePrefix}: ${description}`
        : typePrefix;
      const response = await fetch("/api/credit-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: selectedInvoice || null,
          customerId: selectedCustomer,
          amount: parseFloat(amount),
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
        alert(error.error || "Failed to create credit note");
      }
    } catch (error) {
      console.error("Error creating credit note:", error);
      alert("Failed to create credit note");
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
          Create New Credit Note
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice Selection */}
        <div className="space-y-2">
          <Label htmlFor="invoice" className="text-sm font-medium">
            Invoice <span className="text-red-500">*</span>
          </Label>
          <Select value={selectedInvoice} onValueChange={setSelectedInvoice}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Invoice" />
            </SelectTrigger>
            <SelectContent>
              {invoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.invoiceNumber}>
                  {invoice.invoiceNumber} - {invoice.customer.PersonName || invoice.customer.CompanyName} 
                  ({invoice.currency} {invoice.totalAmount.toLocaleString()})
                </SelectItem>
              ))}
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
                <SelectItem value="CREDIT">CREDIT</SelectItem>
                <SelectItem value="DEBIT">DEBIT</SelectItem>
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
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
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
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
