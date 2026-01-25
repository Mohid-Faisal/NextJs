"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  ArrowUpCircle,
  Search,
  Calendar,
  Table,
  ArrowUpDown,
  ArrowUp,
  Printer,
  FileText
} from "lucide-react";
import { format, parseISO } from "date-fns";

type Payment = {
  id: number;
  transactionType: string;
  category: string;
  date: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  mode: string;
  reference?: string;
  invoice?: string;
  description?: string;
};

type SortField = "date" | "amount" | "toAccount" | "mode";
type SortOrder = "asc" | "desc";

export default function VendorPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [periodType, setPeriodType] = useState<'month' | 'last3month' | 'last6month' | 'last12month' | 'custom' | 'all'>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

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
      case 'last12month':
        const twelveMonthsAgo = new Date(now);
        twelveMonthsAgo.setMonth(now.getMonth() - 12);
        startDate = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth(), twelveMonthsAgo.getDate());
        break;
      case 'custom':
        // Validate that dates are complete (YYYY-MM-DD format, 10 characters)
        if (customStartDate && customEndDate && 
            customStartDate.length === 10 && customEndDate.length === 10) {
          const startDateObj = new Date(customStartDate);
          const endDateObj = new Date(customEndDate);
          // Check if dates are valid
          if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
            startDate = new Date(customStartDate);
            startDate.setHours(0, 0, 0, 0); // Start of the day
            endDate = new Date(customEndDate);
            endDate.setHours(23, 59, 59, 999); // End of the selected day
          } else {
            // Invalid dates - don't update
            setDateRange(undefined);
            return;
          }
        } else {
          // Don't set date range if custom dates not provided or incomplete
          setDateRange(undefined);
          return;
        }
        break;
      default:
        setDateRange(undefined);
        return;
    }

    setDateRange({ from: startDate, to: endDate });
  };

  // Update date range when period type or custom dates change
  useEffect(() => {
    updatePeriodDates();
  }, [periodType, customStartDate, customEndDate]);

  useEffect(() => {
    fetchPayments();
  }, [dateRange]);

  useEffect(() => {
    filterAndSortPayments();
  }, [payments, searchTerm, sortField, sortOrder]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: "Expense",
        limit: "all",
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
      });

      const response = await fetch(`/api/accounts/payments?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        const paymentsArray = Array.isArray(data.payments) ? data.payments : [];
        setPayments(paymentsArray);
        setFilteredPayments(paymentsArray);
      } else {
        setPayments([]);
        setFilteredPayments([]);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      setPayments([]);
      setFilteredPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPayments = () => {
    if (!Array.isArray(payments)) {
      setFilteredPayments([]);
      return;
    }
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.toAccount?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.amount.toString().includes(searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        case "toAccount":
          aValue = a.toAccount?.toLowerCase() || "";
          bValue = b.toAccount?.toLowerCase() || "";
          break;
        case "mode":
          aValue = a.mode?.toLowerCase() || "";
          bValue = b.mode?.toLowerCase() || "";
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredPayments(filtered);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? "↑" : "↓";
  };

  const totalAmount = Array.isArray(filteredPayments) ? filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0) : 0;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  const exportToPrint = async (data: any[], headers: string[], title: string) => {
    let logoBase64 = '';
    try {
      const assetsResponse = await fetch('/api/assets/logo-footer');
      if (assetsResponse.ok) {
        const assets = await assetsResponse.json();
        logoBase64 = assets.logo || '';
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const tableHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <meta charset="utf-8">
            <style>
              * { box-sizing: border-box; }
              html, body { 
                font-family: Arial, sans-serif; 
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body {
                padding: 20px;
              }
              .header-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
              }
              .logo-section img {
                width: 200px;
                height: auto;
              }
              .report-title {
                font-size: 20px;
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
              }
              table { 
                border-collapse: collapse; 
                width: 100%; 
                margin: 20px 0;
              }
              th { 
                background-color: #4a5568;
                color: white;
                font-weight: 600;
                padding: 10px 8px;
                text-align: left;
                border: 1px solid #2d3748;
                font-size: 11px;
              }
              td { 
                padding: 8px;
                text-align: left;
                border: 1px solid #e2e8f0;
                font-size: 11px;
              }
              tbody tr:nth-child(even) {
                background-color: #f7fafc;
              }
              .amount-cell {
                text-align: right;
              }
              @media print {
                @page {
                  margin: 0.5in 0.25in;
                  size: A4;
                }
              }
            </style>
          </head>
          <body>
            <div class="header-section">
              <div class="logo-section">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo">` : ''}
              </div>
              <div>
                <div class="report-title">${title}</div>
                <div>Generated on: ${new Date().toLocaleDateString()}</div>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  ${headers.map(h => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.map(row => `<tr>${row.map((cell: any, idx: number) => 
                  `<td class="${idx >= 2 ? 'amount-cell' : ''}">${cell}</td>`
                ).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;
      
      printWindow.document.write(tableHTML);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const exportToPDF = async (data: any[], headers: string[], title: string) => {
    setIsGeneratingPDF(true);
    try {
      const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');
      
      const styles = StyleSheet.create({
        page: {
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          padding: 30,
        },
        table: {
          width: 'auto',
          borderStyle: 'solid',
          borderWidth: 1,
          borderRightWidth: 0,
          borderBottomWidth: 0,
        },
        tableRow: {
          flexDirection: 'row',
        },
        tableColHeader: {
          width: '14.28%',
          borderStyle: 'solid',
          borderWidth: 1,
          backgroundColor: '#4a5568',
          padding: 8,
        },
        tableCol: {
          width: '14.28%',
          borderStyle: 'solid',
          borderWidth: 1,
          padding: 6,
        },
        tableCellHeader: {
          fontSize: 9,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        tableCell: {
          fontSize: 9,
          color: '#2d3748',
        },
      });

      const MyDocument = () => (
        <Document>
          <Page size="A4" style={styles.page}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>{title}</Text>
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

  const handleExportExcel = () => {
    const headers = ["Date", "To", "Amount", "Mode", "Invoice", "Reference", "Description"];
    const data = filteredPayments.map(p => [
      format(parseISO(p.date), "dd/MM/yyyy"),
      p.toAccount || "-",
      (p.amount || 0).toLocaleString(),
      p.mode || "-",
      p.invoice || "-",
      p.reference || "-",
      p.description || "-"
    ]);
    exportToExcel(data, headers, 'vendor_payments');
  };

  const handleExportPrint = async () => {
    const headers = ["Date", "To", "Amount", "Mode", "Invoice", "Reference", "Description"];
    const data = filteredPayments.map(p => [
      format(parseISO(p.date), "dd/MM/yyyy"),
      p.toAccount || "-",
      (p.amount || 0).toLocaleString(),
      p.mode || "-",
      p.invoice || "-",
      p.reference || "-",
      p.description || "-"
    ]);
    await exportToPrint(data, headers, 'Vendor Payments Report');
  };

  const handleExportPDF = () => {
    const headers = ["Date", "To", "Amount", "Mode", "Invoice", "Reference", "Description"];
    const data = filteredPayments.map(p => [
      format(parseISO(p.date), "dd/MM/yyyy"),
      p.toAccount || "-",
      (p.amount || 0).toLocaleString(),
      p.mode || "-",
      p.invoice || "-",
      p.reference || "-",
      p.description || "-"
    ]);
    exportToPDF(data, headers, 'Vendor Payments Report');
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Vendor Payments Report
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View all expense payments made to vendors
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search payments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:max-w-sm"
          />
        </div>

        <div className="flex gap-4 items-end flex-wrap">
          <Select
            value={periodType}
            onValueChange={(value: string) => setPeriodType(value as any)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="month">Current Month</SelectItem>
              <SelectItem value="last3month">Last 3 Months</SelectItem>
              <SelectItem value="last6month">Last 6 Months</SelectItem>
              <SelectItem value="last12month">Last 12 Months</SelectItem>
              <SelectItem value="custom">Custom Period</SelectItem>
            </SelectContent>
          </Select>

          {periodType === 'custom' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full sm:w-44 min-w-[160px]"
              />
              <span className="text-gray-500 shrink-0">to</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full sm:w-44 min-w-[160px]"
              />
            </div>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[120px] justify-between">
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
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-orange-600" />
            Total Vendor Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {totalAmount.toLocaleString()}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} made
          </p>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle>Vendor Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-10 text-gray-600 dark:text-gray-400">
              No vendor payments found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Date {getSortIcon("date")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("toAccount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        To {getSortIcon("toAccount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Amount {getSortIcon("amount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("mode")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Payment Mode {getSortIcon("mode")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Invoice</th>
                    <th className="px-4 py-2 text-left">Reference</th>
                    <th className="px-4 py-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        {format(parseISO(payment.date), "dd/MM/yyyy")}
                      </td>
                      <td className="px-4 py-3 font-medium">{payment.toAccount || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-orange-600 dark:text-orange-400">
                        {payment.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{payment.mode || "-"}</td>
                      <td className="px-4 py-3">{payment.invoice || "-"}</td>
                      <td className="px-4 py-3">{payment.reference || "-"}</td>
                      <td className="px-4 py-3">{payment.description || "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={2} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right text-orange-600 dark:text-orange-400">
                      {totalAmount.toLocaleString()}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
