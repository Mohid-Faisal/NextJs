"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  format,
  parseISO,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from "date-fns";

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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

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
      setTotal(vendorInvoices.length);
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
    setTotal(vendorInvoices.length);
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

  const totalAmount = useMemo(
    () => invoices.reduce((acc, i) => acc + i.totalAmount, 0),
    [invoices]
  );

  // Custom calendar functions
  const getDaysInMonth = (date: Date) => {
    const start = startOfWeek(startOfMonth(date));
    const end = endOfWeek(endOfMonth(date));
    return eachDayOfInterval({ start, end });
  };

  const isInRange = (date: Date) => {
    if (!dateRange?.from || !dateRange?.to) return false;
    return isWithinInterval(date, { start: dateRange.from, end: dateRange.to });
  };

  const isRangeStart = (date: Date) => {
    return dateRange?.from && isSameDay(date, dateRange.from);
  };

  const isRangeEnd = (date: Date) => {
    return dateRange?.to && isSameDay(date, dateRange.to);
  };

  const handleDateClick = (date: Date) => {
    if (!dateRange?.from || (dateRange.from && dateRange.to)) {
      // Start new range
      setDateRange({ from: date, to: undefined });
    } else {
      // Complete the range
      if (date < dateRange.from) {
        setDateRange({ from: date, to: dateRange.from });
      } else {
        setDateRange({ from: dateRange.from, to: date });
      }
    }
  };

  const formatRangeLabelText = (range?: { from: Date; to?: Date }) => {
    if (!range?.from) return "Select date range";
    if (range.to) {
      return `${format(range.from, "dd-MM-yyyy")} to ${format(range.to, "dd-MM-yyyy")}`;
    }
    return format(range.from, "dd-MM-yyyy");
  };

  const parseDateInput = (input: string) => {
    // Parse formats like "dd-MM-yyyy to dd-MM-yyyy" or "dd-MM-yyyy"
    const parts = input.split(" to ");
    if (parts.length === 2) {
      const fromDate = parseDate(parts[0].trim());
      const toDate = parseDate(parts[1].trim());
      if (fromDate && toDate) {
        return { from: fromDate, to: toDate };
      }
    } else if (parts.length === 1) {
      const fromDate = parseDate(parts[0].trim());
      if (fromDate) {
        return { from: fromDate, to: undefined };
      }
    }
    return undefined;
  };

  const parseDate = (dateStr: string) => {
    // Parse dd-MM-yyyy format
    const match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    if (inputValue.trim()) {
      const parsedRange = parseDateInput(inputValue);
      if (parsedRange) {
        setDateRange(parsedRange);
        setPage(1);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue(formatRangeLabelText(dateRange));
    }
  };

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
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
            {total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Records
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
              onValueChange={(value) => {
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
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["All", "Pending", "Paid", "Overdue","Partial"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <div>
            <div className="relative">
              <Input
                type="text"
                placeholder="dd-MM-yyyy to dd-MM-yyyy"
                value={isEditing ? inputValue : formatRangeLabelText(dateRange)}
                onChange={handleInputChange}
                onFocus={() => {
                  setIsEditing(true);
                  setInputValue(formatRangeLabelText(dateRange));
                }}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                onClick={() => !isEditing && setShowDatePicker(!showDatePicker)}
                className="w-full sm:w-64 bg-muted cursor-text"
              />
              {!isEditing && (
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              )}
              {showDatePicker && (
                <div className="absolute right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 sm:p-4 w-[280px] sm:w-[400px] lg:w-[600px]" style={{ minWidth: "280px" }}>
                  <div className="flex flex-col lg:flex-row gap-2 sm:gap-4">
                    {/* Left Calendar */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          ←
                        </button>
                        <h3 className="text-sm font-medium">
                          {format(currentMonth, "MMM yyyy")}
                        </h3>
                        <div className="w-6"></div>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                          <div key={day} className="p-2 text-center text-gray-500 font-medium">
                            {day}
                          </div>
                        ))}
                        {getDaysInMonth(currentMonth).map((day, index) => (
                          <button
                            key={index}
                            onClick={() => handleDateClick(day)}
                            className={`p-2 text-center text-xs rounded hover:bg-orange-50 dark:hover:bg-orange-900 ${
                              !isSameMonth(day, currentMonth) 
                                ? "text-gray-300 dark:text-gray-600" 
                                : isRangeStart(day)
                                ? "bg-orange-500 text-white"
                                : isRangeEnd(day)
                                ? "bg-orange-500 text-white"
                                : isInRange(day)
                                ? "bg-orange-100 dark:bg-orange-800"
                                : "text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {format(day, "d")}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Right Calendar */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-6"></div>
                        <h3 className="text-sm font-medium">
                          {format(addMonths(currentMonth, 1), "MMM yyyy")}
                        </h3>
                        <button
                          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          →
                        </button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-xs">
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
                          <div key={day} className="p-2 text-center text-gray-500 font-medium">
                            {day}
                          </div>
                        ))}
                        {getDaysInMonth(addMonths(currentMonth, 1)).map((day, index) => (
                          <button
                            key={index}
                            onClick={() => handleDateClick(day)}
                            className={`p-2 text-center text-xs rounded hover:bg-orange-50 dark:hover:bg-orange-900 ${
                              !isSameMonth(day, addMonths(currentMonth, 1)) 
                                ? "text-gray-300 dark:text-gray-600" 
                                : isRangeStart(day)
                                ? "bg-orange-500 text-white"
                                : isRangeEnd(day)
                                ? "bg-orange-500 text-white"
                                : isInRange(day)
                                ? "bg-orange-100 dark:bg-orange-800"
                                : "text-gray-700 dark:text-gray-200"
                            }`}
                          >
                            {format(day, "d")}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {dateRange?.from && dateRange?.to
                        ? `${format(dateRange.from, "dd-MM-yyyy")} to ${format(dateRange.to, "dd-MM-yyyy")}`
                        : "Select date range"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
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
                          setDateRange({ from: twoMonthsAgo, to: tomorrow });
                          setCurrentMonth(twoMonthsAgo);
                        }}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        Restore Default
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDateRange(undefined);
                          setShowDatePicker(false);
                        }}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowDatePicker(false)}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                      <span className="hidden sm:inline">Tracking#</span>
                      <span className="sm:hidden">Track#</span>
                      {getSortIcon("trackingNumber")}
                    </button>
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
                    <span className="hidden sm:inline">Vendor</span>
                    <span className="sm:hidden">Vendor</span>
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
                      <span className="hidden sm:inline">{getCountryNameFromCode(i.destination)}</span>
                      <span className="sm:hidden">{getCountryNameFromCode(i.destination)?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span
                        className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                          i.status === "Paid"
                            ? "bg-green-100 text-green-800"
                            : i.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : i.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
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
                      <span className="hidden sm:inline">{i.vendor?.PersonName || i.vendor?.CompanyName || "-"}</span>
                      <span className="sm:hidden">{i.vendor?.PersonName?.substring(0, 10) || i.vendor?.CompanyName?.substring(0, 10) || "-"}...</span>
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
                              window.location.href = `/dashboard/accounts/payments/process?invoice=${i.invoiceNumber}`;
                            }}
                            className="text-orange-600 font-medium"
                          >
                            💰 Process Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/dashboard/accounts/invoices/add?id=${i.id}`;
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
                              window.location.href = `/api/accounts/invoices/${i.id}/invoice`;
                            }}
                          >
                            🧾 Download Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Pending")}
                            className={i.status === "Pending" ? "bg-yellow-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-yellow-100 text-yellow-800 text-xs flex items-center justify-center">P</span>
                            Mark as Pending
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

      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
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
    </div>
  );
}
