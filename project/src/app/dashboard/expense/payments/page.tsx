"use client";

import { useEffect, useState, useRef } from "react";
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
import { ArrowLeft, Search, Info, ShoppingCart } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  shipment?: {
    shipmentDate: string | Date;
  };
};

type ChartOfAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
};

export default function ExpensePaymentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.ceil(total / pageSize);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const invoiceFetchAttempted = useRef<string | null>(null);
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
    paymentDate: new Date().toISOString().split('T')[0], // Default to today
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [page, searchTerm, statusFilter, pageSize]);

  // Update accounts when payment method changes
  useEffect(() => {
    if (accountsInitialized && accounts.length > 0 && selectedInvoice) {
      updateAccountsBasedOnPaymentMethod(accounts);
    }
  }, [formData.paymentMethod, accountsInitialized, accounts, selectedInvoice]);

  // Handle pre-selection of invoice from URL parameter
  useEffect(() => {
    const invoiceParam = searchParams.get("invoice");
    const billParam = searchParams.get("bill");
    const billIdParam = searchParams.get("billId");
    const amountParam = searchParams.get("amount");
    const vendorParam = searchParams.get("vendor");
    const statusParam = searchParams.get("status");
    
    // Handle bill parameters (from bills page)
    if (billParam && billIdParam) {
      const invoice = invoices.find(
        (inv) => inv.invoiceNumber === billParam
      );
      if (invoice) {
        setSelectedInvoice(invoice);
        // Set payment amount from URL parameter or remaining amount
        const remainingAmount = invoice.remainingAmount;
        if (remainingAmount !== undefined && remainingAmount > 0) {
          setFormData((prev) => ({
            ...prev,
            paymentAmount: remainingAmount.toString(),
          }));
        } else if (amountParam) {
          setFormData((prev) => ({
            ...prev,
            paymentAmount: amountParam,
          }));
        }
        // Set payment date to shipment date if available
        if (invoice.shipment?.shipmentDate) {
          const shipmentDate = invoice.shipment.shipmentDate;
          const dateStr = shipmentDate instanceof Date 
            ? shipmentDate.toISOString().split('T')[0]
            : new Date(shipmentDate).toISOString().split('T')[0];
          setFormData((prev) => ({
            ...prev,
            paymentDate: dateStr,
          }));
        }
        // Set default accounts for the selected invoice
        if (accountsInitialized && accounts.length > 0) {
          setDefaultAccountsForInvoice(accounts, invoice);
        }
        // Open the payment dialog
        setPaymentDialogOpen(true);
        invoiceFetchAttempted.current = null; // Reset on success
      } else if (billParam && invoiceFetchAttempted.current !== billParam) {
        // Invoice not found in current page, fetch it directly by searching
        invoiceFetchAttempted.current = billParam; // Mark as attempted
        const fetchSpecificInvoice = async () => {
          try {
            const params = new URLSearchParams({
              page: "1",
              limit: "1000", // Large limit to find the invoice
              profile: "Vendor",
              search: billParam,
            });
            const response = await fetch(`/api/accounts/invoices?${params.toString()}`);
            const data = await response.json();
            if (response.ok) {
              const foundInvoice = (data.invoices || []).find(
                (inv: Invoice) => inv.invoiceNumber === billParam && inv.profile === "Vendor"
              );
              if (foundInvoice) {
                setSelectedInvoice(foundInvoice);
                // Set payment amount from remaining amount or URL parameter
                const remainingAmount = foundInvoice.remainingAmount;
                if (remainingAmount !== undefined && remainingAmount > 0) {
                  setFormData((prev) => ({
                    ...prev,
                    paymentAmount: remainingAmount.toString(),
                  }));
                } else if (amountParam) {
                  setFormData((prev) => ({
                    ...prev,
                    paymentAmount: amountParam,
                  }));
                }
                // Set payment date to shipment date if available
                if (foundInvoice.shipment?.shipmentDate) {
                  const shipmentDate = foundInvoice.shipment.shipmentDate;
                  const dateStr = shipmentDate instanceof Date 
                    ? shipmentDate.toISOString().split('T')[0]
                    : new Date(shipmentDate).toISOString().split('T')[0];
                  setFormData((prev) => ({
                    ...prev,
                    paymentDate: dateStr,
                  }));
                }
                // Set default accounts for the selected invoice
                if (accountsInitialized && accounts.length > 0) {
                  setDefaultAccountsForInvoice(accounts, foundInvoice);
                }
                // Open the payment dialog
                setPaymentDialogOpen(true);
              }
            }
          } catch (error) {
            console.error("Error fetching specific invoice:", error);
            invoiceFetchAttempted.current = null; // Reset on error to allow retry
          }
        };
        fetchSpecificInvoice();
      }
    }
    // Handle invoice parameters (from other sources)
    else if (invoiceParam) {
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
        // Set payment date to shipment date if available
        if (invoice.shipment?.shipmentDate) {
          const shipmentDate = invoice.shipment.shipmentDate;
          const dateStr = shipmentDate instanceof Date 
            ? shipmentDate.toISOString().split('T')[0]
            : new Date(shipmentDate).toISOString().split('T')[0];
          setFormData((prev) => ({
            ...prev,
            paymentDate: dateStr,
          }));
        }
        // Set default accounts for the selected invoice
        if (accountsInitialized && accounts.length > 0) {
          setDefaultAccountsForInvoice(accounts, invoice);
        }
        // Open the payment dialog
        setPaymentDialogOpen(true);
        invoiceFetchAttempted.current = null; // Reset on success
      } else if (invoiceParam && invoices.length > 0 && invoiceFetchAttempted.current !== invoiceParam) {
        // Invoice not found in current page, fetch it directly by searching
        invoiceFetchAttempted.current = invoiceParam; // Mark as attempted
        const fetchSpecificInvoice = async () => {
          try {
            const params = new URLSearchParams({
              page: "1",
              limit: "1000", // Large limit to find the invoice
              profile: "Vendor",
              search: invoiceParam,
            });
            const response = await fetch(`/api/accounts/invoices?${params.toString()}`);
            const data = await response.json();
            if (response.ok) {
              const foundInvoice = (data.invoices || []).find(
                (inv: Invoice) => inv.invoiceNumber === invoiceParam && inv.profile === "Vendor"
              );
              if (foundInvoice) {
                setSelectedInvoice(foundInvoice);
                // Set payment amount to remaining amount if available
                const remainingAmount = foundInvoice.remainingAmount;
                if (remainingAmount !== undefined && remainingAmount > 0) {
                  setFormData((prev) => ({
                    ...prev,
                    paymentAmount: remainingAmount.toString(),
                  }));
                }
                // Set payment date to shipment date if available
                if (foundInvoice.shipment?.shipmentDate) {
                  const shipmentDate = foundInvoice.shipment.shipmentDate;
                  const dateStr = shipmentDate instanceof Date 
                    ? shipmentDate.toISOString().split('T')[0]
                    : new Date(shipmentDate).toISOString().split('T')[0];
                  setFormData((prev) => ({
                    ...prev,
                    paymentDate: dateStr,
                  }));
                }
                // Set default accounts for the selected invoice
                if (accountsInitialized && accounts.length > 0) {
                  setDefaultAccountsForInvoice(accounts, foundInvoice);
                }
                // Open the payment dialog
                setPaymentDialogOpen(true);
              }
            }
          } catch (error) {
            console.error("Error fetching specific invoice:", error);
            invoiceFetchAttempted.current = null; // Reset on error to allow retry
          }
        };
        fetchSpecificInvoice();
      }
    } else {
      invoiceFetchAttempted.current = null; // Reset when no invoice param
    }
  }, [searchParams, invoices, accountsInitialized, accounts]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        profile: "Vendor",
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        sortField: "shipmentDate",
        sortOrder: "desc",
      });

      const response = await fetch(`/api/accounts/invoices?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        // Double-check that only vendor invoices are included
        const vendorInvoices = (data.invoices || []).filter(
          (invoice: Invoice) => invoice.profile === "Vendor"
        );
        setInvoices(vendorInvoices);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error("Error fetching vendor invoices:", error);
    } finally {
      setLoading(false);
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
    // For vendor payments: We are paying the vendor for expenses
    // Debit Accounts Payable (vendor's liability), Credit Cash (we paid money)
    updateAccountsBasedOnPaymentMethod(accounts);
  };

  // Update accounts based on payment method
  const updateAccountsBasedOnPaymentMethod = (accounts: ChartOfAccount[], paymentMethod?: string) => {
    const method = paymentMethod || formData.paymentMethod;
    const accountsPayableAccount = accounts.find(
      (a) => a.accountName === "Accounts Payable"
    );
    const cashAccount = accounts.find((a) => a.accountName === "Cash");
    const bankAccount = accounts.find(
      (a) => a.accountName === "Bank Account" || 
            a.accountName === "Bank" ||
            (a.category === "Asset" && a.accountName.toLowerCase().includes("bank"))
    );

    // Debit account is always Accounts Payable for vendor payments
    if (accountsPayableAccount) {
      setDebitAccountId(accountsPayableAccount.id);
    }

    // Credit account depends on payment method
    switch (method) {
      case "CASH":
        if (cashAccount) {
          setCreditAccountId(cashAccount.id);
        }
        break;
      case "BANK_TRANSFER":
        if (bankAccount) {
          setCreditAccountId(bankAccount.id);
        } else if (cashAccount) {
          // Fallback to cash if no bank account found
          setCreditAccountId(cashAccount.id);
        }
        break;
      case "CHECK":
        // Checks are typically paid from bank, but can be cash
        if (bankAccount) {
          setCreditAccountId(bankAccount.id);
        } else if (cashAccount) {
          setCreditAccountId(cashAccount.id);
        }
        break;
      case "CREDIT_CARD":
        // Credit card payments typically come from bank account
        if (bankAccount) {
          setCreditAccountId(bankAccount.id);
        } else if (cashAccount) {
          setCreditAccountId(cashAccount.id);
        }
        break;
      default:
        if (cashAccount) {
          setCreditAccountId(cashAccount.id);
        }
    }
  };

  // No need for client-side filtering anymore - server handles it
  const filteredInvoices = invoices;

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
          paymentType: "VENDOR_PAYMENT",
          paymentMethod: formData.paymentMethod,
          reference: formData.reference,
          description: formData.description,
          paymentDate: formData.paymentDate,
          // Chart of accounts
          debitAccountId,
          creditAccountId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Vendor payment processed successfully!", {
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
          paymentDate: new Date().toISOString().split('T')[0],
        });
        setPaymentDialogOpen(false);
        fetchInvoices(); // Refresh invoice list
        setPage(1); // Reset to first page
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
      case "Unpaid":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "Paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Partial":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Overdue":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
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
          <ShoppingCart className="w-8 sm:w-10 h-8 sm:h-10 text-orange-600" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
            Vendor Payments
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Process vendor payments and record expenses
        </p>
        <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
          Showing only Vendor invoices for payment processing
        </p>
      </div>

      <div className="w-full">
        {/* Invoice Selection */}
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-4 sm:mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Select Vendor Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-end gap-3">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Search invoices by number, tracking, or vendor..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full"
                />
              </div>
              <div className="shrink-0 w-20 sm:w-24">
                <Label className="mb-2 block text-xs sm:text-sm">Show</Label>
                <Select
                  value={pageSize.toString()}
                  onValueChange={(value: string) => {
                    setPageSize(parseInt(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Show" />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="shrink-0 w-24 sm:w-32">
                <Label className="mb-2 block text-xs sm:text-sm">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: string) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {["All", "Unpaid", "Paid", "Overdue", "Partial"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No vendor invoices found
                </p>
              ) : (
                filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedInvoice?.id === invoice.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600"
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
                      // Set payment date to shipment date if available
                      if (invoice.shipment?.shipmentDate) {
                        const shipmentDate = invoice.shipment.shipmentDate;
                        const dateStr = shipmentDate instanceof Date 
                          ? shipmentDate.toISOString().split('T')[0]
                          : new Date(shipmentDate).toISOString().split('T')[0];
                        setFormData((prev) => ({
                          ...prev,
                          paymentDate: dateStr,
                        }));
                      }
                      if (accountsInitialized && accounts.length > 0) {
                        setDefaultAccountsForInvoice(accounts, invoice);
                      }
                      setPaymentDialogOpen(true);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
                          {invoice.invoiceNumber}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {invoice.vendor?.CompanyName ||
                            invoice.vendor?.PersonName}
                        </p>
                      </div>
                      <span
                        className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          invoice.status
                        )}`}
                      >
                        <span className="hidden sm:inline">{invoice.status}</span>
                        <span className="sm:hidden">{invoice.status?.substring(0, 3)}</span>
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      PKR {invoice.totalAmount.toLocaleString()} •{" "}
                      {invoice.trackingNumber} • PKR{" "}
                      {invoice.remainingAmount?.toLocaleString()}
                      {invoice.shipment?.shipmentDate && (
                        <> • {new Date(invoice.shipment.shipmentDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => prev - 1)}
                  className="hover:scale-105 transition-transform w-full sm:w-auto"
                >
                  ← Prev
                </Button>
                <span className="text-center">
                  Page {page} of {totalPages}
                </span>
                <Button
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="hover:scale-105 transition-transform w-full sm:w-auto"
                >
                  Next →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Process Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent size="xl" className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Process Vendor Payment
              </DialogTitle>
            </DialogHeader>
            <div>
            {selectedInvoice ? (
              <div>
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-2 text-center">
                    Selected Invoice
                  </h3>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Invoice: {selectedInvoice.invoiceNumber}</div>
                      <div>
                        Original Amount: PKR{" "}
                        {selectedInvoice.totalAmount.toLocaleString()}
                      </div>
                      {selectedInvoice.remainingAmount !== undefined && (
                        <div className="font-semibold text-orange-600 dark:text-orange-400">
                          Remaining Amount: PKR{" "}
                          {selectedInvoice.remainingAmount.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 text-right">
                      <div>
                        Status: <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedInvoice.status)}`}>{selectedInvoice.status}</span>
                      </div>
                      {selectedInvoice.trackingNumber && (
                        <div>Tracking: {selectedInvoice.trackingNumber}</div>
                      )}
                      <div>Vendor: {selectedInvoice.vendor?.CompanyName || selectedInvoice.vendor?.PersonName}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="text-gray-500 text-center text-sm sm:text-base">
                  Please select a vendor invoice to process payment
                </p>
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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

                <div className="space-y-1.5">
                  <Label htmlFor="paymentDate" className="text-sm font-medium">
                    Payment Date
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={formData.paymentDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        paymentDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="paymentMethod" className="text-sm font-medium">
                    Payment Method
                  </Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) => {
                      setFormData((prev) => ({ ...prev, paymentMethod: value }));
                      // Update accounts when payment method changes
                      if (accountsInitialized && accounts.length > 0) {
                        updateAccountsBasedOnPaymentMethod(accounts, value);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="CHECK">Check</SelectItem>
                      <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
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
                    Debit Account (Accounts Payable)
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
                            account.accountName === "Accounts Payable" ||
                            account.category === "Liability"
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
                    Credit Account (Cash Paid)
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
                        .filter((account) => {
                          // Filter based on payment method
                          if (formData.paymentMethod === "CASH") {
                            return account.accountName === "Cash" || 
                                   (account.category === "Asset" && account.accountName.toLowerCase().includes("cash"));
                          } else if (formData.paymentMethod === "BANK_TRANSFER") {
                            return account.accountName === "Bank Account" || 
                                   account.accountName === "Bank" ||
                                   (account.category === "Asset" && account.accountName.toLowerCase().includes("bank"));
                          } else if (formData.paymentMethod === "CHECK" || formData.paymentMethod === "CREDIT_CARD") {
                            // For check and credit card, show bank accounts first, then cash
                            return account.accountName === "Bank Account" || 
                                   account.accountName === "Bank" ||
                                   account.accountName === "Cash" ||
                                   (account.category === "Asset" && (
                                     account.accountName.toLowerCase().includes("bank") ||
                                     account.accountName.toLowerCase().includes("cash")
                                   ));
                          }
                          // Default: show cash and assets
                          return account.accountName === "Cash" || account.category === "Asset";
                        })
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
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {processing ? "Processing..." : "Process Vendor Payment"}
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
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
