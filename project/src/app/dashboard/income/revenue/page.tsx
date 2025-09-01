"use client";

import { useEffect, useState } from "react";
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
import { ArrowLeft, Search, Info, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Invoice = {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  customer?: {
    id: number;
    CompanyName: string;
    PersonName: string;
  };
  vendor?: {
    id: number;
    CompanyName: string;
    PersonName: string;
  };
  profile: string;
  invoiceDate: string;
  trackingNumber?: string;
  destination: string;
  remainingAmount?: number;
};

type ChartOfAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
};

export default function IncomeRevenuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [debitAccountId, setDebitAccountId] = useState<number>(0);
  const [creditAccountId, setCreditAccountId] = useState<number>(0);
  const [accountsInitialized, setAccountsInitialized] = useState(false);
  const [formData, setFormData] = useState({
    paymentAmount: "",
    paymentMethod: "CASH",
    invoice: "",
    reference: "",
    description: "",
  });

  useEffect(() => {
    fetchInvoices();
    fetchAccounts();
  }, []);

  // Handle pre-selection of invoice from URL parameter
  useEffect(() => {
    const invoiceParam = searchParams.get("invoice");
    if (invoiceParam && invoices.length > 0) {
      const invoice = invoices.find(
        (inv) => inv.invoiceNumber === invoiceParam
      );
      if (invoice) {
        setSelectedInvoice(invoice);
        // Set payment amount to remaining amount if available
        const remainingAmount = invoice.remainingAmount;
        if (remainingAmount !== undefined && remainingAmount > 0) {
          setFormData((prev) => ({
            ...prev,
            paymentAmount: remainingAmount.toString(),
          }));
        }
        // Set default accounts for the selected invoice
        if (accountsInitialized && accounts.length > 0) {
          setDefaultAccountsForInvoice(accounts, invoice);
        }
      }
    }
  }, [searchParams, invoices, accountsInitialized, accounts]);

  const fetchInvoices = async () => {
    try {
      // Only fetch customer invoices
      const response = await fetch("/api/accounts/invoices?profile=Customer");
      const data = await response.json();

      if (response.ok) {
        // Double-check that only customer invoices are included
        const customerInvoices = (data.invoices || []).filter(
          (invoice: Invoice) => invoice.profile === "Customer"
        );
        setInvoices(customerInvoices);
      }
    } catch (error) {
      console.error("Error fetching customer invoices:", error);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chart-of-accounts?limit=1000");
      const data = await response.json();

      if (data.success && data.data) {
        setAccounts(data.data);
        setDefaultAccounts(data.data);
        setAccountsInitialized(true);
        console.log("Loaded accounts:", data.data.length);
      } else {
        console.error("Failed to load accounts:", data);
        toast.error("Failed to load chart of accounts");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Error loading chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  const initializeChartOfAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chart-of-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        await fetchAccounts(); // Reload accounts after initialization
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error initializing accounts:", error);
      toast.error("Failed to initialize chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  const setDefaultAccounts = (accounts: ChartOfAccount[]) => {
    // Default accounts will be set when an invoice is selected
    console.log(
      "Accounts loaded, default accounts will be set when invoice is selected"
    );
  };

  const setDefaultAccountsForInvoice = (
    accounts: ChartOfAccount[],
    invoice: Invoice
  ) => {
    // For customer payments: Customer has already paid, so we record the income
    // Debit Cash (we received money), Credit Accounts Receivable (customer's credit balance)
    const cashAccount = accounts.find((a) => a.accountName === "Cash");
    const accountsReceivableAccount = accounts.find(
      (a) => a.accountName === "Accounts Receivable"
    );

    if (cashAccount) {
      setDebitAccountId(cashAccount.id);
      console.log(
        "Set default debit account for customer payment:",
        cashAccount.accountName
      );
    }
    if (accountsReceivableAccount) {
      setCreditAccountId(accountsReceivableAccount.id);
      console.log(
        "Set default credit account for customer payment:",
        accountsReceivableAccount.accountName
      );
    }
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.trackingNumber
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      invoice.customer?.CompanyName.toLowerCase().includes(
        searchTerm.toLowerCase()
      ) ||
      invoice.customer?.PersonName.toLowerCase().includes(
        searchTerm.toLowerCase()
      )
  );

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInvoice) return;

    // Validate chart of accounts selection
    if (!debitAccountId || !creditAccountId) {
      toast.error("Please select both debit and credit accounts.");
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch("/api/accounts/payments/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: selectedInvoice.invoiceNumber,
          paymentAmount: formData.paymentAmount,
          paymentType: "CUSTOMER_PAYMENT",
          paymentMethod: formData.paymentMethod,
          reference: formData.reference,
          description: formData.description,
          // Chart of accounts
          debitAccountId,
          creditAccountId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Customer payment processed successfully!", {
          description: `Payment of PKR ${parseFloat(
            formData.paymentAmount
          ).toLocaleString()} has been processed for invoice ${
            selectedInvoice.invoiceNumber
          }`,
        });
        setSelectedInvoice(null);
        setFormData({
          paymentAmount: "",
          paymentMethod: "CASH",
          invoice: "",
          reference: "",
          description: "",
        });
        fetchInvoices(); // Refresh invoice list
      } else {
        toast.error("Payment failed", {
          description:
            data.error || "An error occurred while processing the payment",
        });
      }
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Payment failed", {
        description: "Failed to process payment. Please try again.",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Partial":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Pending":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="mb-4 sm:mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 sm:w-10 h-8 sm:h-10 text-green-600" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
            Customer Revenue
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Process customer payments and record revenue
        </p>
        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
          Showing only Customer invoices for payment processing
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Invoice Selection */}
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Select Customer Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search invoices by number, tracking, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mb-4"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No customer invoices found
                </p>
              ) : (
                filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedInvoice?.id === invoice.id
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600"
                    }`}
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      const remainingAmount = invoice.remainingAmount;
                      if (
                        remainingAmount !== undefined &&
                        remainingAmount > 0
                      ) {
                        setFormData((prev) => ({
                          ...prev,
                          paymentAmount: remainingAmount.toString(),
                        }));
                      }
                      if (accountsInitialized && accounts.length > 0) {
                        setDefaultAccountsForInvoice(accounts, invoice);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                          {invoice.invoiceNumber}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {invoice.customer?.CompanyName ||
                            invoice.customer?.PersonName}
                        </p>
                      </div>
                      <span
                        className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          invoice.status
                        )}`}
                      >
                        <span className="hidden sm:inline">
                          {invoice.status}
                        </span>
                        <span className="sm:hidden">
                          {invoice.status?.substring(0, 3)}
                        </span>
                        </span>
                      </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      PKR {invoice.totalAmount.toLocaleString()} •{" "}
                      {invoice.trackingNumber} • PKR{" "}
                      {invoice.remainingAmount?.toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Process Customer Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedInvoice ? (
              <div>
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
                    Selected Invoice
                </h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <div>Invoice: {selectedInvoice.invoiceNumber}</div>
                    <div>
                      Original Amount: PKR{" "}
                      {selectedInvoice.totalAmount.toLocaleString()}
                    </div>
                    {selectedInvoice.remainingAmount !== undefined && (
                      <div className="font-semibold text-green-600 dark:text-green-400">
                        Remaining Amount: PKR{" "}
                        {selectedInvoice.remainingAmount.toLocaleString()}
                      </div>
                    )}
                    <div>Status: {selectedInvoice.status}</div>
                    <div>Profile: {selectedInvoice.profile}</div>
                    {selectedInvoice.trackingNumber && (
                      <div>Tracking: {selectedInvoice.trackingNumber}</div>
                    )}
                    <div>Customer: {selectedInvoice.customer?.CompanyName || selectedInvoice.customer?.PersonName}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 text-center text-sm sm:text-base">
                  Please select a customer invoice to process payment
                </p>
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-3 sm:space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentAmount" className="text-sm font-medium">
                  Payment Amount
                </Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={formData.paymentAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      paymentAmount: e.target.value,
                    }))
                  }
                  placeholder="Enter payment amount"
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label
                    htmlFor="paymentMethod"
                    className="text-sm font-medium"
                  >
                    Payment Method
                  </Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: value }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">
                        Bank Transfer
                      </SelectItem>
                      <SelectItem value="CHECK">Check</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 flex-1">
                  <Label htmlFor="reference" className="text-sm font-medium">
                    Reference
                  </Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reference: e.target.value,
                      }))
                    }
                    placeholder="Payment reference"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Payment description"
                />
              </div>

              {/* Chart of Accounts Selection */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                  Chart of Accounts
                </h3>

                <div className="space-y-1.5">
                  <Label htmlFor="debitAccount" className="text-sm font-medium">
                    Debit Account (Cash Received)
                  </Label>
                  <Select
                    value={debitAccountId.toString()}
                    onValueChange={(value) =>
                      setDebitAccountId(parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select debit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter(
                          (account) =>
                            account.accountName === "Cash" ||
                            account.category === "Asset"
                        )
                        .map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id.toString()}
                          >
                            {account.code} - {account.accountName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="creditAccount"
                    className="text-sm font-medium"
                  >
                    Credit Account (Accounts Receivable)
                  </Label>
                  <Select
                    value={creditAccountId.toString()}
                    onValueChange={(value) =>
                      setCreditAccountId(parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select credit account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter(
                          (account) =>
                            account.accountName === "Accounts Receivable" ||
                            account.category === "Asset"
                        )
                        .map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id.toString()}
                          >
                            {account.code} - {account.accountName}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                disabled={!selectedInvoice || processing || loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {processing ? "Processing..." : "Process Customer Payment"}
              </Button>
            </form>

            {!accountsInitialized && (
              <div className="mt-4 p-3 sm:p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 text-xs sm:text-sm mb-2">
                  Chart of accounts not initialized. Please initialize to
                  proceed.
                </p>
                <Button
                  onClick={initializeChartOfAccounts}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                >
                  {loading ? "Initializing..." : "Initialize Chart of Accounts"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
