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
import { ArrowLeft, Search, Info } from "lucide-react";
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

export default function ProcessPaymentPage() {
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
    description: ""
  });

  useEffect(() => {
    fetchInvoices();
    fetchAccounts();
  }, []);

  // Handle pre-selection of invoice from URL parameter
  useEffect(() => {
    const invoiceParam = searchParams.get('invoice');
    if (invoiceParam && invoices.length > 0) {
      const invoice = invoices.find(inv => inv.invoiceNumber === invoiceParam);
      if (invoice) {
        setSelectedInvoice(invoice);
        // Set payment amount to remaining amount if available
        const remainingAmount = invoice.remainingAmount;
        if (remainingAmount !== undefined && remainingAmount > 0) {
          setFormData(prev => ({
            ...prev,
            paymentAmount: remainingAmount.toString()
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
      const response = await fetch("/api/accounts/invoices");
      const data = await response.json();
      
      if (response.ok) {
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
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
        body: JSON.stringify({ action: "initialize" })
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
    // This function is kept for backward compatibility
    console.log("Accounts loaded, default accounts will be set when invoice is selected");
  };

  const setDefaultAccountsForInvoice = (accounts: ChartOfAccount[], invoice: Invoice) => {
    if (invoice.profile === "Customer") {
      // For customer payments: Customer has already paid, so we record the income
      // Debit Cash (we received money), Credit Revenue (income earned)
      const cashAccount = accounts.find(a => a.accountName === "Cash");
      const revenueAccount = accounts.find(a => 
        a.category === "Revenue" && 
        (a.accountName.includes("Freight") || a.accountName.includes("Services") || a.accountName.includes("Revenue"))
      );
      
      if (cashAccount) {
        setDebitAccountId(cashAccount.id);
        console.log("Set default debit account for customer payment:", cashAccount.accountName);
      }
      if (revenueAccount) {
        setCreditAccountId(revenueAccount.id);
        console.log("Set default credit account for customer payment:", revenueAccount.accountName);
      }
    } else if (invoice.profile === "Vendor") {
      // For vendor payments: We are paying the vendor for expenses
      // Debit Expense (cost incurred), Credit Cash (we paid money)
      const expenseAccount = accounts.find(a => 
        a.category === "Expense" && 
        (a.accountName.includes("Operations") || a.accountName.includes("Fuel") || a.accountName.includes("Maintenance") || a.accountName.includes("Expense"))
      );
      const cashAccount = accounts.find(a => a.accountName === "Cash");
      
      if (expenseAccount) {
        setDebitAccountId(expenseAccount.id);
        console.log("Set default debit account for vendor payment:", expenseAccount.accountName);
      }
      if (cashAccount) {
        setCreditAccountId(cashAccount.id);
        console.log("Set default credit account for vendor payment:", cashAccount.accountName);
      }
    }
  };

  const filteredInvoices = invoices.filter(invoice => 
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer?.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.vendor?.CompanyName.toLowerCase().includes(searchTerm.toLowerCase())
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
      const paymentType = selectedInvoice.profile === "Customer" ? "CUSTOMER_PAYMENT" : "VENDOR_PAYMENT";
      
      const response = await fetch("/api/accounts/payments/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: selectedInvoice.invoiceNumber,
          paymentAmount: formData.paymentAmount,
          paymentType,
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
        toast.success("Payment processed successfully!", {
          description: `Payment of $${parseFloat(formData.paymentAmount).toLocaleString()} has been processed for invoice ${selectedInvoice.invoiceNumber}`,
        });
        setSelectedInvoice(null);
        setFormData({
          paymentAmount: "",
          paymentMethod: "CASH",
          invoice: "",
          reference: "",
          description: ""
        });
        fetchInvoices(); // Refresh invoice list
      } else {
        toast.error("Payment failed", {
          description: data.error || "An error occurred while processing the payment",
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
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Process Payment
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Select an invoice and process payment
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Selection */}
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
              Select Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by invoice number, tracking number, or company name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedInvoice?.id === invoice.id
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    if (accountsInitialized && accounts.length > 0) {
                      setDefaultAccountsForInvoice(accounts, invoice);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-800 dark:text-white">
                        {invoice.invoiceNumber}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {invoice.profile}: {invoice.customer?.CompanyName || invoice.vendor?.CompanyName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        ${invoice.totalAmount.toLocaleString()} • {invoice.trackingNumber} • {invoice.remainingAmount?.toLocaleString()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Form */}
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
              Payment Details
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
                    <div>Original Amount: ${selectedInvoice.totalAmount.toLocaleString()}</div>
                    {selectedInvoice.remainingAmount !== undefined && (
                      <div className="font-semibold text-blue-600 dark:text-blue-400">
                        Remaining Amount: ${selectedInvoice.remainingAmount.toLocaleString()}
                      </div>
                    )}
                    <div>Status: {selectedInvoice.status}</div>
                    <div>Profile: {selectedInvoice.profile}</div>
                    {selectedInvoice.trackingNumber && (
                      <div>Tracking: {selectedInvoice.trackingNumber}</div>
                    )}
                  </div>
                </div>

                {selectedInvoice.profile === "Customer" && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start">
                      <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Customer Payment Note:</strong> If the payment amount exceeds the invoice total, 
                        the excess amount will be added to the customer's credit balance for future invoices.
                        <br />
                        <strong>Default Accounts:</strong> Debit Cash, Credit Revenue (Freight/Services)
                      </div>
                    </div>
                  </div>
                )}

                {selectedInvoice.profile === "Vendor" && (
                  <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <div className="flex items-start">
                      <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>Vendor Payment Note:</strong> This payment reduces the amount owed to the vendor.
                        <br />
                        <strong>Default Accounts:</strong> Debit Expense (Operations/Fuel/Maintenance), Credit Cash
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <Label htmlFor="paymentAmount" className="font-bold">
                      Payment Amount
                    </Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      value={formData.paymentAmount}
                      onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                      className="mt-1"
                      required
                      min="0"
                    />
                    {selectedInvoice.remainingAmount !== undefined && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedInvoice.remainingAmount !== undefined ? (
                          <>
                            Original: ${selectedInvoice.totalAmount.toLocaleString()} • 
                            Remaining: ${selectedInvoice.remainingAmount.toLocaleString()}
                            {selectedInvoice.remainingAmount < selectedInvoice.totalAmount && (
                              <span className="text-blue-600"> (balance already applied)</span>
                            )}
                          </>
                        ) : (
                          <>
                            Invoice amount: ${selectedInvoice.totalAmount.toLocaleString()}
                            {selectedInvoice.status === "Partial" && " (partial payment already made)"}
                          </>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Chart of Accounts Section */}
                  <div>
                    <Label htmlFor="debitAccount" className="font-bold">
                      Debit Account
                    </Label>
                    <Select value={String(debitAccountId)} onValueChange={(value) => setDebitAccountId(parseInt(value))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={loading ? "Loading accounts..." : "Select debit account"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loading ? (
                          <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
                        ) : accounts.length === 0 ? (
                          <SelectItem value="no-accounts" disabled>No accounts available</SelectItem>
                        ) : (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.code} - {account.accountName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 && !loading && (
                      <p className="text-xs text-red-500 mt-1">
                        No chart of accounts found. Please initialize the chart of accounts first.
                      </p>
                    )}
                    {accounts.length === 0 && !loading && (
                      <Button
                        type="button"
                        onClick={initializeChartOfAccounts}
                        disabled={loading}
                        className="mt-2 text-sm"
                        variant="outline"
                      >
                        {loading ? "Initializing..." : "Initialize Chart of Accounts"}
                      </Button>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="creditAccount" className="font-bold">
                      Credit Account
                    </Label>
                    <Select value={String(creditAccountId)} onValueChange={(value) => setCreditAccountId(parseInt(value))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={loading ? "Loading accounts..." : "Select credit account"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loading ? (
                          <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
                        ) : accounts.length === 0 ? (
                          <SelectItem value="no-accounts" disabled>No accounts available</SelectItem>
                        ) : (
                          accounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.code} - {account.accountName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {accounts.length === 0 && !loading && (
                      <p className="text-xs text-red-500 mt-1">
                        No chart of accounts found. Please initialize the chart of accounts first.
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod" className="font-bold">
                      Payment Method
                    </Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CARD">Card</SelectItem>
                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="invoice" className="font-bold">
                      Invoice Number
                    </Label>
                    <Input
                      id="invoice"
                      value={selectedInvoice.invoiceNumber}
                      className="mt-1 bg-gray-50"
                      readOnly
                    />
                  </div>

                  <div>
                    <Label htmlFor="reference" className="font-bold">
                      Reference *
                    </Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                      className="mt-1"
                      placeholder="Payment reference number"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description" className="font-bold">
                      Description (Optional)
                    </Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="mt-1"
                      placeholder="Payment description"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {processing ? "Processing..." : "Process Payment"}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Select an invoice to process payment
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
