"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCountryNameFromCode } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Table,
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Printer,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  Calendar,
  ShoppingCart,
} from "lucide-react";
import DeleteDialog from "@/components/DeleteDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";

// Edit Invoice Form Component
const EditInvoiceForm = ({ 
  invoice, 
  onSuccess, 
  onCancel 
}: { 
  invoice: any; 
  onSuccess: () => void; 
  onCancel: () => void; 
}) => {
  const [form, setForm] = useState({
    invoiceNumber: invoice?.invoiceNumber || "",
    invoiceDate: invoice?.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : "",
    trackingNumber: invoice?.trackingNumber || "",
    destination: invoice?.destination || "",
    weight: invoice?.weight || 0,
    fscCharges: invoice?.fscCharges || 0,
    status: invoice?.status || "Unpaid",
    totalAmount: invoice?.totalAmount || 0,
    currency: invoice?.currency || "USD"
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`/api/accounts/invoices/${invoice.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Invoice updated successfully!");
        onSuccess();
      } else {
        toast.error(data.message || "Failed to update invoice");
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="invoiceNumber" className="text-sm font-medium">Invoice Number</label>
          <Input
            id="invoiceNumber"
            name="invoiceNumber"
            value={form.invoiceNumber}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="invoiceDate" className="text-sm font-medium">Invoice Date</label>
          <Input
            id="invoiceDate"
            name="invoiceDate"
            type="date"
            value={form.invoiceDate}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="trackingNumber" className="text-sm font-medium">Tracking Number</label>
          <Input
            id="trackingNumber"
            name="trackingNumber"
            value={form.trackingNumber}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <Select
            value={form.status}
            onValueChange={(value: string) =>
              setForm((prev) => ({ ...prev, status: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Unpaid">Unpaid</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Overdue">Overdue</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Shipping Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="destination" className="text-sm font-medium">Destination</label>
          <Input
            id="destination"
            name="destination"
            value={form.destination}
            onChange={handleChange}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="weight" className="text-sm font-medium">Weight</label>
          <Input
            id="weight"
            name="weight"
            type="number"
            step="0.01"
            value={form.weight}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      {/* Financial Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="fscCharges" className="text-sm font-medium">FSC Charges</label>
          <Input
            id="fscCharges"
            name="fscCharges"
            type="number"
            step="0.01"
            value={form.fscCharges}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="totalAmount" className="text-sm font-medium">Total Amount</label>
          <Input
            id="totalAmount"
            name="totalAmount"
            type="number"
            step="0.01"
            value={form.totalAmount}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="currency" className="text-sm font-medium">Currency</label>
          <Select
            value={form.currency}
            onValueChange={(value: string) =>
              setForm((prev) => ({ ...prev, currency: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="PKR">PKR</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-sm px-4">
          Cancel
        </Button>
        <Button type="submit" className="text-sm px-4">
          Update Invoice
        </Button>
      </div>
    </form>
  );
};

type Invoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  receiptNumber?: string;
  trackingNumber?: string;
  destination: string;
  dayWeek?: string;
  weight: number;
  profile: string;
  fscCharges: number;
  lineItems: any[];
  status: string;
  totalAmount: number;
  currency: string;
  customer?: {
    CompanyName: string;
    PersonName: string;
  };
  vendor?: {
    CompanyName: string;
    PersonName: string;
  };
  shipment?: {
    trackingId: string;
    awbNumber: string;
  };
  createdAt: string;
};

type SortField = keyof Invoice;
type SortOrder = "asc" | "desc";

export default function ExpenseBillsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [periodType, setPeriodType] = useState<'month' | 'last3month' | 'last6month' | 'year' | 'financialyear' | 'custom'>('last3month');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(() => {
    const now = new Date();
    const twoMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 2,
      now.getDate()
    );
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    return { from: twoMonthsAgo, to: tomorrow };
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [sortField, setSortField] = useState<SortField>("invoiceDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null);

  // Update date range based on period type
  const updatePeriodDates = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1); // Tomorrow to include today

    switch (periodType) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last3month':
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1);
        break;
      case 'last6month':
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        startDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'financialyear':
        if (now.getMonth() >= 6) {
          startDate = new Date(now.getFullYear(), 6, 1); // July 1 of current year
        } else {
          startDate = new Date(now.getFullYear() - 1, 6, 1); // July 1 of previous year
        }
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          startDate.setHours(0, 0, 0, 0); // Start of the day
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999); // End of the selected day
        } else {
          // Default to last 3 months if custom dates not set
          const threeMonthsAgo = new Date(now);
          threeMonthsAgo.setMonth(now.getMonth() - 3);
          startDate = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1);
        }
        break;
      default:
        const defaultThreeMonthsAgo = new Date(now);
        defaultThreeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = new Date(defaultThreeMonthsAgo.getFullYear(), defaultThreeMonthsAgo.getMonth(), 1);
    }

    setDateRange({ from: startDate, to: endDate });
  };

  useEffect(() => {
    updatePeriodDates();
  }, [periodType, customStartDate, customEndDate]);

  useEffect(() => {
    const fetchInvoices = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        profile: "Vendor", // Only fetch vendor invoices
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/accounts/invoices?${params.toString()}`);
      const json = await res.json();
      console.log('Vendor Invoices data:', json.invoices); // Debug log
      
      // Validate that all invoices are vendor invoices
      const vendorInvoices = json.invoices.filter((invoice: any) => invoice.profile === "Vendor");
      console.log('Filtered Vendor Invoices:', vendorInvoices.length, 'out of', json.invoices.length);
      
      setInvoices(vendorInvoices);
      setTotal(json.total || 0);
      setTotalAmount(json.totalAmount || 0);
    };

    fetchInvoices();
  }, [page, pageSize, statusFilter, searchTerm, dateRange, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleDelete = async () => {
    // This function will be called by DeleteDialog after successful deletion
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === "all" ? "all" : String(pageSize),
      profile: "Vendor", // Only fetch vendor invoices
      ...(statusFilter !== "All" && { status: statusFilter }),
      ...(searchTerm && { search: searchTerm }),
      ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
      ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
      sortField: sortField,
      sortOrder: sortOrder,
    });
    const res = await fetch(`/api/accounts/invoices?${params.toString()}`);
    const json = await res.json();
    
    // Validate that all invoices are vendor invoices
    const vendorInvoices = json.invoices.filter((invoice: any) => invoice.profile === "Vendor");
    setInvoices(vendorInvoices);
    setTotal(json.total || 0);
  };

  const handleStatusChange = async (invoiceId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/accounts/invoices/${invoiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Update the local state to reflect the change
        setInvoices(prevInvoices =>
          prevInvoices.map(invoice =>
            invoice.id === invoiceId
              ? { ...invoice, status: newStatus }
              : invoice
          )
        );
      } else {
        console.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // totalAmount is now fetched from API, no need to calculate from current page

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Invoice #",
      "Date",
      "Receipt #",
      "Tracking #",
      "Destination",
      "Status",
      "Total Amount",
      "Vendor",
    ];
    const rows = invoices.map((i) => [
      i.id,
      i.invoiceNumber,
      new Date(i.invoiceDate).toLocaleDateString(),
      i.receiptNumber || "",
      i.trackingNumber || "",
      getCountryNameFromCode(i.destination),
      i.status,
      `${i.currency} ${i.totalAmount.toLocaleString()}`,
      i.vendor?.PersonName || i.vendor?.CompanyName || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vendor_invoices_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = invoices
      .map(
        (i) => `
        <tr>
          <td>${i.id}</td>
          <td>${i.invoiceNumber}</td>
          <td>${new Date(i.invoiceDate).toLocaleDateString()}</td>
          <td>${i.receiptNumber || ""}</td>
          <td>${i.trackingNumber || ""}</td>
          <td>${getCountryNameFromCode(i.destination)}</td>
          <td>${i.status}</td>
          <td>${i.currency} ${i.totalAmount.toLocaleString()}</td>
          <td>${i.vendor?.PersonName || i.vendor?.CompanyName || ""}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Vendor Invoices</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Vendor Invoices</h1>
          <p>Total Amount: ${totalAmount.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Receipt #</th>
                <th>Tracking #</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Vendor</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <ShoppingCart className="w-8 sm:w-10 h-8 sm:h-10 text-orange-600" />
            Vendor Bills
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your vendor invoices and track expenses</p>
          <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Showing only Vendor invoices</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-right bg-orange-50 dark:bg-orange-900/20 px-4 py-3 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="text-lg sm:text-xl font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Total Records
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
              {total}
            </div>
          </div>
          <div className="text-right bg-orange-50 dark:bg-orange-900/20 px-4 py-3 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="text-lg sm:text-xl font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Total Amount
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
              {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        {/* Left side - Page size and Search bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value: string) => {
                setPageSize(value === "all" ? "all" : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full max-w-sm">
            <Input
              placeholder="Search by invoice #, tracking #, vendor..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            <div className="bg-orange-500 px-3 flex items-center justify-center rounded-r-md text-white text-sm">
              Search
            </div>
          </div>
        </div>

        {/* Right side - Status, Date Range, and Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <Select
            value={statusFilter}
            onValueChange={(v: string) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["All", "Unpaid", "Paid", "Overdue","Partial"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Select
              value={periodType}
              onValueChange={(value: string) => {
                setPeriodType(value as any);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Current Month</SelectItem>
                <SelectItem value="last3month">Last 3 Month</SelectItem>
                <SelectItem value="last6month">Last 6 Month</SelectItem>
                <SelectItem value="year">Current Year</SelectItem>
                <SelectItem value="financialyear">Financial Year</SelectItem>
                <SelectItem value="custom">Custom Period</SelectItem>
              </SelectContent>
            </Select>
            
            {periodType === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full sm:w-44 min-w-[160px]"
                />
                <span className="text-gray-500 shrink-0">to</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="w-full sm:w-44 min-w-[160px]"
                />
              </div>
            )}
          </div>
          
          {/* Export Dropdown */}
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-[120px] justify-between bg-blue-500 text-white hover:bg-blue-600 border-blue-500">
                  Export
                  <ArrowUp className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[120px]">
                <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2">
                  <Table className="w-4 h-4" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPrint} className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {invoices.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No vendor invoices found.
            </p>
          ) : (
            <>
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">ID</span>
                      <span className="sm:hidden">ID</span>
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Invoice#</span>
                      <span className="sm:hidden">Inv#</span>
                      {getSortIcon("invoiceNumber")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceDate")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Date</span>
                      <span className="sm:hidden">Date</span>
                      {getSortIcon("invoiceDate")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("trackingNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Tracking</span>
                      <span className="sm:hidden">Track#</span>
                      {getSortIcon("trackingNumber")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Vendor</span>
                    <span className="sm:hidden">Vendor</span>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("destination")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Destination</span>
                      <span className="sm:hidden">Dest</span>
                      {getSortIcon("destination")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Status</span>
                      <span className="sm:hidden">Status</span>
                      {getSortIcon("status")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalAmount")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Total Amount</span>
                      <span className="sm:hidden">Amount</span>
                      {getSortIcon("totalAmount")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Actions</span>
                    <span className="sm:hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">{i.id}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{i.invoiceNumber}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      {new Date(i.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{i.trackingNumber || "-"}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{i.vendor?.CompanyName ||i.vendor?.PersonName ||  "-"}</span>
                      <span className="sm:hidden">{i.vendor?.CompanyName?.substring(0, 10) || i.vendor?.PersonName?.substring(0, 10) || "-"}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{getCountryNameFromCode(i.destination)}</span>
                      <span className="sm:hidden">{getCountryNameFromCode(i.destination)?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span
                        className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                          i.status === "Unpaid"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : i.status === "Paid"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : i.status === "Partial"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : i.status === "Overdue"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        <span className="hidden sm:inline">{i.status}</span>
                        <span className="sm:hidden">{i.status?.substring(0, 3)}</span>
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      {i.currency} {i.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/dashboard/expense/payments?bill=${i.invoiceNumber}&billId=${i.id}&amount=${i.totalAmount}&vendor=${encodeURIComponent(i.vendor?.PersonName || i.vendor?.CompanyName || '')}&status=${i.status}`;
                            }}
                            className="text-orange-600 font-medium"
                          >
                            💰 Process Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInvoiceToEdit(i);
                              setOpenEditDialog(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInvoiceToDelete(i);
                              setOpenDeleteDialog(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/api/accounts/invoices/${i.id}/receipt`;
                            }}
                          >
                            📄 Download Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const shipmentId = (i.shipment as any)?.id;
                              if (shipmentId) {
                                window.location.href = `/dashboard/invoices/edit/${shipmentId}?invID=${i.id}`;
                              } else {
                                alert('No shipment associated with this invoice');
                              }
                            }}
                          >
                            🧾 Edit & Download Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Unpaid")}
                            className={i.status === "Unpaid" ? "bg-yellow-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-yellow-100 text-yellow-800 text-xs flex items-center justify-center">P</span>
                            Mark as Unpaid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Paid")}
                            className={i.status === "Paid" ? "bg-green-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-green-100 text-green-800 text-xs flex items-center justify-center">✓</span>
                            Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Overdue")}
                            className={i.status === "Overdue" ? "bg-red-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-red-100 text-red-800 text-xs flex items-center justify-center">!</span>
                            Mark as Overdue
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Cancelled")}
                            className={i.status === "Cancelled" ? "bg-gray-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-gray-100 text-gray-800 text-xs flex items-center justify-center">✕</span>
                            Mark as Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination and Total Count */}
      <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
        <div className="text-center sm:text-left">
          {pageSize === 'all' 
            ? `Showing all ${total} bills`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} bills`
          }
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
              className="hover:scale-105 transition-transform w-full sm:w-auto"
            >
              ← Prev
            </Button>
            <span>
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
      </div>

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="max-w-md w-full">
          <DeleteDialog
            entityType="invoice"
            entityId={invoiceToDelete?.id || 0}
            onDelete={() => {
              handleDelete();
              setInvoiceToDelete(null);
            }}
            onClose={() => {
              setOpenDeleteDialog(false);
              setInvoiceToDelete(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent size="4xl" className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl text-center mb-6 font-bold">Edit Invoice</h2>
            <EditInvoiceForm
              invoice={invoiceToEdit}
              onSuccess={() => {
                handleDelete(); // Refresh the list
                setOpenEditDialog(false);
                setInvoiceToEdit(null);
              }}
              onCancel={() => {
                setOpenEditDialog(false);
                setInvoiceToEdit(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
