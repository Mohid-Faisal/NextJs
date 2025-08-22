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
import { Calendar, X } from "lucide-react";

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
  const [selectedBill, setSelectedBill] = useState<string>("");
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch available bills and vendors
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

    fetchBills();
    fetchVendors();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVendor || !amount || !date) {
      alert("Please fill in all required fields");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/debit-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billId: selectedBill || null,
          vendorId: selectedVendor,
          amount: parseFloat(amount),
          date,
          description,
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
          <Select value={selectedBill} onValueChange={setSelectedBill}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Bill" />
            </SelectTrigger>
            <SelectContent>
              {bills.map((bill) => (
                <SelectItem key={bill.id} value={bill.id.toString()}>
                  {bill.invoiceNumber} - {bill.vendor.PersonName || bill.vendor.CompanyName} 
                  ({bill.currency} {bill.totalAmount.toLocaleString()})
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
              required
            />
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
