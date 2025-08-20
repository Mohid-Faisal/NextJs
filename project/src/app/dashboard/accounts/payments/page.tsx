"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { Table, Plus, Edit, Trash2, Search, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
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

type Payment = {
  id: number;
  transactionType: "Income" | "Expense" | "Transfer" | "Adjustment" | "Equity";
  category: string;
  date: string; // ISO
  amount: number;
  fromAccount: string;
  toAccount: string;
  mode: "Cash" | "Bank Transfer" | "Card" | "Cheque";
  reference?: string;
  invoice?: string;
  description?: string;
  journalEntryNumber?: string; // Add journal entry number
};

type SortField = keyof Payment;
type SortOrder = "asc" | "desc";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [typeFilter, setTypeFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Date range states
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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(typeFilter !== "All" && { type: typeFilter }),
        ...(modeFilter !== "All" && { mode: modeFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/accounts/payments?${params.toString()}`);
      const json = await res.json();
      setPayments(json.payments);
      setTotal(json.total);
    };

    fetchPayments();
  }, [page, pageSize, typeFilter, modeFilter, searchTerm, dateRange, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Calendar functions
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
      setDateRange({ from: date, to: undefined });
    } else {
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

  const totalAmount = useMemo(
    () => payments.reduce((acc, p) => acc + p.amount, 0),
    [payments]
  );

  // Export functions
  const exportToExcel = (data: any[], headers: string[], filename: string) => {
    const csvContent = [headers, ...data]
      .map(row => row.map((cell: any) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPrint = (data: any[], headers: string[], title: string, total: number) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const tableHTML = `
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              h1 { color: #333; }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <p>Total: ${total}</p>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <table>
              <thead>
                <tr>
                  ${headers.map(header => `<th>${header}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `<tr>${row.map((cell: any) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      printWindow.document.write(tableHTML);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const exportToPDF = async (data: any[], headers: string[], title: string, total: number) => {
    setIsGeneratingPDF(true);
    try {
      const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');
      
      const styles = StyleSheet.create({
        page: {
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          padding: 30,
        },
        title: {
          fontSize: 24,
          marginBottom: 10,
          textAlign: 'center',
          color: '#333',
        },
        subtitle: {
          fontSize: 12,
          marginBottom: 5,
          color: '#666',
        },
        table: {
          width: 'auto',
          borderStyle: 'solid',
          borderWidth: 1,
          borderRightWidth: 0,
          borderBottomWidth: 0,
          borderColor: '#bfbfbf',
        },
        tableRow: {
          margin: 'auto',
          flexDirection: 'row',
        },
        tableColHeader: {
          width: '9.09%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
          backgroundColor: '#4285f4',
        },
        tableCol: {
          width: '9.09%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
        },
        tableCellHeader: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 6,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        tableCell: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 6,
          color: '#333',
        },
      });

      const MyDocument = () => {
        return (
          <Document>
            <Page size="A4" style={styles.page}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Total: {total}</Text>
              <Text style={styles.subtitle}>Generated on: {new Date().toLocaleDateString()}</Text>
              
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  {headers.map((header, index) => (
                    <View key={index} style={styles.tableColHeader}>
                      <Text style={styles.tableCellHeader}>{header}</Text>
                    </View>
                  ))}
                </View>
                
                {data.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.tableRow}>
                    {row.map((cell: any, cellIndex: number) => (
                      <View key={cellIndex} style={styles.tableCol}>
                        <Text style={styles.tableCell}>{String(cell || '')}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </Page>
          </Document>
        );
      };

      const blob = await pdf(<MyDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('PDF generation error:', error);
      alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getPaymentExportData = (payments: Payment[]) => {
    const headers = ["ID", "Type", "Category", "Date", "Amount", "From", "To", "Mode", "Reference", "Invoice"];
    const data = payments.map(payment => [
      payment.id,
      payment.transactionType,
      payment.category,
      format(parseISO(payment.date), "dd-MM-yyyy"),
      `$${payment.amount.toLocaleString()}`,
      payment.fromAccount,
      payment.toAccount,
      payment.mode,
      payment.reference || "N/A",
      payment.invoice || "N/A"
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getPaymentExportData(payments);
    exportToExcel(data, headers, 'payments');
  };

  const handleExportPrint = () => {
    const { headers, data } = getPaymentExportData(payments);
    exportToPrint(data, headers, 'Payments Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getPaymentExportData(payments);
    exportToPDF(data, headers, 'Payments Report', total);
  };

     const handleEdit = (payment: Payment) => {
     // Navigate to add payment page with edit mode and payment data
     const queryParams = new URLSearchParams({
       mode: 'edit',
       id: payment.id.toString(),
       transactionType: payment.transactionType,
       category: payment.category,
       date: payment.date,
       amount: payment.amount.toString(),
       fromAccount: payment.fromAccount,
       toAccount: payment.toAccount,
       paymentMode: payment.mode, // Changed from 'mode' to 'paymentMode' to avoid conflict
       reference: payment.reference || '',
       invoice: payment.invoice || '',
       description: payment.description || ''
     });
     
     // Add customer ID for Return transactions
     if (payment.transactionType === "Adjustment" && payment.toAccount !== "Us") {
       // Extract customer ID from toAccount if it's a customer name
       // This assumes the toAccount contains the customer ID when it's a customer
       queryParams.append('toCustomerId', payment.toAccount);
     }
     
     window.location.href = `/dashboard/accounts/payments/add?${queryParams.toString()}`;
   };

  const handleViewJournalEntry = (journalEntryNumber: string) => {
    // Navigate to journal entries page with filter for this entry
    window.location.href = `/dashboard/journal-entries?search=${journalEntryNumber}`;
  };

  const handleDelete = (payment: Payment) => {
    setPaymentToDelete(payment);
    setOpenDeleteDialog(true);
  };

  const handleDeleteSuccess = async () => {
    // Refresh the payments list
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === "all" ? "all" : String(pageSize),
      ...(typeFilter !== "All" && { type: typeFilter }),
      ...(modeFilter !== "All" && { mode: modeFilter }),
      ...(searchTerm && { search: searchTerm }),
      ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
      ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/accounts/payments?${params.toString()}`);
    const json = await res.json();
    setPayments(json.payments);
    setTotal(json.total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">Payments</h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center justify-between gap-4">
        {/* Left side - Show Entries first, then Search field */}
        <div className="flex items-center gap-4">
          {/* Show Entries Dropdown - First position from left */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(value === "all" ? "all" : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[80px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search field */}
          <div className="flex-1 max-w-md">
            <div className="flex">
              <Input
                placeholder="Search by type, category, amount, from, to, mode, reference, invoice..."
                value={searchTerm}
                onChange={(e) => {
                  setPage(1);
                  setSearchTerm(e.target.value);
                }}
                className="rounded-r-none"
              />
              <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md">
                <Search className="text-white w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Center - Date Range Filter */}
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
            className="w-64 bg-muted cursor-text"
          />
          {!isEditing && (
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          )}
          {showDatePicker && (
            <div className="absolute left-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4" style={{ minWidth: "600px" }}>
              <div className="flex gap-4">
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
                        className={`p-2 text-center text-xs rounded hover:bg-blue-50 dark:hover:bg-blue-900 ${
                          !isSameMonth(day, currentMonth) 
                            ? "text-gray-300 dark:text-gray-600" 
                            : isRangeStart(day)
                            ? "bg-blue-500 text-white"
                            : isRangeEnd(day)
                            ? "bg-blue-500 text-white"
                            : isInRange(day)
                            ? "bg-blue-100 dark:bg-blue-800"
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
                        className={`p-2 text-center text-xs rounded hover:bg-blue-50 dark:hover:bg-blue-900 ${
                          !isSameMonth(day, addMonths(currentMonth, 1)) 
                            ? "text-gray-300 dark:text-gray-600" 
                            : isRangeStart(day)
                            ? "bg-blue-500 text-white"
                            : isRangeEnd(day)
                            ? "bg-blue-500 text-white"
                            : isInRange(day)
                            ? "bg-blue-100 dark:bg-blue-800"
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

        {/* Right side - All other controls */}
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {['All','Income','Expense','Transfer','Return'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Mode Filter */}
          <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              {['All','Cash','Bank Transfer','Card','Cheque'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[100px] h-9 justify-between">
                Export
                <ArrowUp className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[120px]">
              <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2">
                <Table className="w-4 h-4" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPrint} className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportPDF} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {isGeneratingPDF ? 'Generating...' : 'PDF'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Payment Button */}
          <Button asChild className="h-9">
            <Link href="/dashboard/accounts/payments/add" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Payment
            </Link>
          </Button>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {payments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">No payments found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("id")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">ID {getSortIcon("id")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("transactionType")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Type {getSortIcon("transactionType")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("category")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Category {getSortIcon("category")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("date")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Date {getSortIcon("date")}</button>
                  </th>

                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("amount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Amount {getSortIcon("amount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("fromAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">From {getSortIcon("fromAccount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("toAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">To {getSortIcon("toAccount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("mode")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Mode {getSortIcon("mode")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("reference")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Reference {getSortIcon("reference")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("invoice")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Invoice {getSortIcon("invoice")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">Journal Entry</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                {payments.map((p) => (
                  <tr key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
                    <td className="px-4 py-3 font-medium">{p.id}</td>
                    <td className="px-4 py-3">{p.transactionType}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">{p.fromAccount}</td>
                    <td className="px-4 py-3">{p.toAccount}</td>
                    <td className="px-4 py-3">{p.mode}</td>
                    <td className="px-4 py-3">{p.reference}</td>
                    <td className="px-4 py-3">{p.invoice || ""}</td>
                    <td className="px-4 py-3">
                      {p.journalEntryNumber ? (
                        <button
                          onClick={() => handleViewJournalEntry(p.journalEntryNumber!)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                          title="View journal entry"
                        >
                          {p.journalEntryNumber}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Edit payment"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="hover:scale-105 transition-transform"
          >
            ← Prev
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="hover:scale-105 transition-transform"
          >
            Next →
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          {paymentToDelete && (
            <DeleteDialog
              entityType="payment"
              entityId={paymentToDelete.id}
              onDelete={handleDeleteSuccess}
              onClose={() => {
                setOpenDeleteDialog(false);
                setPaymentToDelete(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


