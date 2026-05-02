"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { Table, Plus, Edit, Trash2, Search, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Printer, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import DeleteDialog from "@/components/DeleteDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  format,
  parseISO,
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [typeFilter, setTypeFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Date range states
  const [periodType, setPeriodType] = useState<'month' | 'last3month' | 'last6month' | 'year' | 'financialyear' | 'custom'>('month');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    return { from: firstDayOfMonth, to: tomorrow };
  });
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  // Bulk-import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    summary: { processed: number; imported: number; failed: number };
    results: { row: number; success: boolean; message?: string; amount?: number; category?: string; type?: string; journalEntry?: string }[];
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Check for query parameter when coming from dashboard
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'All') {
      setTypeFilter("All");
      // Clear the query parameter from URL
      router.replace('/dashboard/accounts/payments', { scroll: false });
    }
  }, [searchParams, router]);

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
        // Last 12 months from today
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        startDate = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), twelveMonthsAgo.getDate());
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
          setDateRange({ from: startDate, to: endDate });
        } else {
          // Don't set date range if custom dates not provided - prevents fetching
          setDateRange(undefined);
          setPayments([]);
          setTotal(0);
          return;
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
    // Don't fetch if custom period is selected but dates are not provided
    if (periodType === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
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
  }, [page, pageSize, typeFilter, modeFilter, searchTerm, dateRange, sortField, sortOrder, periodType, customStartDate, customEndDate, refreshKey]);

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Please choose an Excel file first");
      return;
    }
    setImporting(true);
    setImportResults(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const res = await fetch("/api/accounts/payments/bulk-import", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "Import failed");
        return;
      }
      setImportResults(json);
      const { imported, failed } = json.summary || { imported: 0, failed: 0 };
      if (failed > 0) {
        toast.warning(`Imported ${imported}, ${failed} failed. See details below.`);
      } else {
        toast.success(`Imported ${imported} transactions`);
      }
      // Refresh the list
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

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
      `PKR ${payment.amount.toLocaleString()}`,
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
       id: payment.id.toString()
     });
     
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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">Transactions</h2>
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Records</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4 flex-wrap">
        {/* Show Entries Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="flex flex-1 min-w-[200px] max-w-sm">
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

        {/* Date Range Filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
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
                <SelectItem value="year">Last 12 Months</SelectItem>
              <SelectItem value="financialyear">Financial Year</SelectItem>
              <SelectItem value="custom">Custom Period</SelectItem>
            </SelectContent>
          </Select>
          
          {periodType === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0 hidden sm:block" />
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-[130px] sm:w-[140px]"
              />
              <span className="text-gray-500 shrink-0 text-xs sm:text-sm">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-[130px] sm:w-[140px]"
              />
            </div>
          )}
        </div>

        {/* Type Filter */}
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[120px] h-9 shrink-0">
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
          <SelectTrigger className="w-[140px] h-9 shrink-0">
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
            <Button variant="outline" className="w-[100px] h-9 justify-between shrink-0">
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

        {/* Import Button */}
        <Button
          variant="outline"
          className="h-9 shrink-0"
          onClick={() => {
            setImportFile(null);
            setImportResults(null);
            setImportDialogOpen(true);
          }}
        >
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>

        {/* Add Payment Button */}
        <Button asChild className="h-9 shrink-0">
          <Link href="/dashboard/accounts/payments/add" className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Transaction
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {payments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">No payments found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("id")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">ID</span>
                      <span className="sm:hidden">ID</span>
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("transactionType")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Type</span>
                      <span className="sm:hidden">Type</span>
                      {getSortIcon("transactionType")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("category")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Category</span>
                      <span className="sm:hidden">Cat</span>
                      {getSortIcon("category")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("date")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Date</span>
                      <span className="sm:hidden">Date</span>
                      {getSortIcon("date")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("amount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Amount</span>
                      <span className="sm:hidden">Amt</span>
                      {getSortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("fromAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">From</span>
                      <span className="sm:hidden">From</span>
                      {getSortIcon("fromAccount")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("toAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">To</span>
                      <span className="sm:hidden">To</span>
                      {getSortIcon("toAccount")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("mode")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Mode</span>
                      <span className="sm:hidden">Mode</span>
                      {getSortIcon("mode")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("reference")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Reference</span>
                      <span className="sm:hidden">Ref</span>
                      {getSortIcon("reference")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button onClick={() => handleSort("invoice")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                      <span className="hidden sm:inline">Invoice</span>
                      <span className="sm:hidden">Inv</span>
                      {getSortIcon("invoice")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Journal Entry</span>
                    <span className="sm:hidden">Journal</span>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Actions</span>
                    <span className="sm:hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                {payments.map((p) => (
                  <tr key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">{p.id}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.transactionType}</span>
                      <span className="sm:hidden">{p.transactionType?.substring(0, 4)}</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.category}</span>
                      <span className="sm:hidden">{p.category?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">PKR {p.amount.toLocaleString()}</td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.fromAccount}</span>
                      <span className="sm:hidden">{p.fromAccount?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.toAccount}</span>
                      <span className="sm:hidden">{p.toAccount?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.mode}</span>
                      <span className="sm:hidden">{p.mode?.substring(0, 4)}</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.reference}</span>
                      <span className="sm:hidden">{p.reference?.substring(0, 8)}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{p.invoice || ""}</span>
                      <span className="sm:hidden">{p.invoice?.substring(0, 8) || ""}...</span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      {p.journalEntryNumber ? (
                        <button
                          onClick={() => handleViewJournalEntry(p.journalEntryNumber!)}
                          className="text-blue-600 hover:text-blue-800 hover:underline text-xs"
                          title="View journal entry"
                        >
                          <span className="hidden sm:inline">{p.journalEntryNumber}</span>
                          <span className="sm:hidden">{p.journalEntryNumber?.substring(0, 6)}...</span>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
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

      {/* Import Transactions Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => {
        if (!importing) setImportDialogOpen(open);
      }}>
        <DialogContent className="max-w-3xl">
          <div className="p-2">
            <h2 className="text-xl font-semibold mb-1">Import Transactions from Excel</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Upload a .xlsx / .xls file with columns:
              <span className="font-medium"> Transaction Type, Category, Date, Amount, Payment Method, Reference, Description</span>.
              Only Income and Expense rows are supported. The chart-of-accounts is matched by category name.
            </p>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center bg-gray-50 dark:bg-gray-800/40 mb-4">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] || null);
                  setImportResults(null);
                }}
                className="block mx-auto text-sm"
                disabled={importing}
              />
              {importFile && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-2">
                  Selected: <span className="font-medium">{importFile.name}</span> ({(importFile.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            {importResults && (
              <div className="mb-4">
                <div className="flex flex-wrap gap-3 mb-3 text-sm">
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                    Processed: <strong>{importResults.summary.processed}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                    Imported: <strong>{importResults.summary.imported}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                    Failed: <strong>{importResults.summary.failed}</strong>
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr className="text-left">
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">JE</th>
                        <th className="px-3 py-2">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.results.map((r) => (
                        <tr key={r.row} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-1.5">{r.row}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${r.success ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                              {r.success ? "OK" : "Failed"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">{r.type || "-"}</td>
                          <td className="px-3 py-1.5">{r.category || "-"}</td>
                          <td className="px-3 py-1.5">{r.amount ? r.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-"}</td>
                          <td className="px-3 py-1.5">{r.journalEntry || "-"}</td>
                          <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{r.message || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(false)}
                disabled={importing}
              >
                Close
              </Button>
              <Button onClick={handleImport} disabled={!importFile || importing}>
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


