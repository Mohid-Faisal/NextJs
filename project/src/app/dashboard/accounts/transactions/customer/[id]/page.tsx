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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ArrowLeft, Search, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Printer, FileText, Table } from "lucide-react";
import { useRouter, useParams } from "next/navigation";
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



type Customer = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
  creditLimit: number;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference?: string;
  invoice?: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
  shipmentDate?: string;
};

export default function CustomerTransactionsPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "CREDIT",
    amount: "",
    description: "",
    reference: ""
  });

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10); // Add limit state
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

  // Sorting states
  type SortField = "createdAt" | "amount" | "type" | "description" | "reference";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchCustomerData();
  }, [customerId, page, searchTerm, dateRange, sortField, sortOrder, limit]); // Add limit to dependencies

  const fetchCustomerData = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm && { search: searchTerm }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField,
        sortOrder,
      });

      const response = await fetch(`/api/accounts/transactions/customer/${customerId}?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setCustomer(data.customer);
        setTransactions(data.transactions);
        setTotal(data.total || data.transactions.length);
      } else {
        console.error("Error fetching customer data:", data.error);
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
    } finally {
      setLoading(false);
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
          width: '16.66%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
          backgroundColor: '#4285f4',
        },
        tableCol: {
          width: '16.66%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
        },
        tableCellHeader: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 8,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        tableCell: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 8,
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

  const getTransactionExportData = (transactions: Transaction[]) => {
    const headers = ["Date", "Type", "Amount", "Description", "Reference", "Invoice", "Balance"];
    const data = transactions.map(transaction => {
      const dateToUse = transaction.shipmentDate || transaction.createdAt;
      let formattedDate: string;
      try {
        formattedDate = format(parseISO(dateToUse), "dd-MM-yyyy");
      } catch (e) {
        formattedDate = new Date(dateToUse).toLocaleDateString('en-GB');
      }
      
      return [
        formattedDate,
        transaction.type,
        `PKR ${transaction.amount.toLocaleString()}`,
        transaction.description,
        transaction.reference || "N/A",
        transaction.invoice || "N/A",
        `PKR ${transaction.newBalance.toLocaleString()}`
      ];
    });
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getTransactionExportData(transactions);
    exportToExcel(data, headers, 'customer_transactions');
  };

  const handleExportPrint = () => {
    const { headers, data } = getTransactionExportData(transactions);
    exportToPrint(data, headers, 'Customer Transactions Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getTransactionExportData(transactions);
    exportToPDF(data, headers, 'Customer Transactions Report', total);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`/api/accounts/transactions/customer/${customerId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reset form and refresh data
        setFormData({
          type: "CREDIT",
          amount: "",
          description: "",
          reference: ""
        });
        setShowAddForm(false);
        fetchCustomerData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction");
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
        <div className="text-center">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            Customer Transactions
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {customer.CompanyName} - {customer.PersonName}
          </p>
        </div>

        {/* Balance Display - Top Right */}
        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Current Balance
          </div>
          <div className="text-2xl font-bold">
            <span
              className={
                customer.currentBalance > 0
                  ? "text-red-600 dark:text-red-400"
                  : customer.currentBalance < 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              ${customer.currentBalance.toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Credit Limit: ${customer.creditLimit.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex justify-between items-end gap-4">
        {/* Left side - Search field */}
        <div>
          <div className="flex w-full max-w-sm">
            <Input
              placeholder="Search by reference, amount, description..."
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

        {/* Right side - Show, Export and Date Range */}
        <div className="flex gap-4 items-end">
          {/* Show Entries Dropdown */}
          <div>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(parseInt(value));
                setPage(1); // Reset to first page when changing limit
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Export Dropdown */}
          <div>
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
                className="w-64 bg-muted cursor-text"
              />
              {!isEditing && (
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              )}
              {showDatePicker && (
                <div className="absolute right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4" style={{ minWidth: "600px" }}>
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
          </div>
        </div>
      </div>

      {/* Add Transaction Button */}
      <div className="mb-6">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <Card className="mb-6 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
              Add Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type" className="font-bold">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount" className="font-bold">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description" className="font-bold">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="reference" className="font-bold">Reference (Optional)</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Add Transaction
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No transactions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("createdAt")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Date {getSortIcon("createdAt")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Invoice</th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("description")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Description {getSortIcon("description")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("reference")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Reference {getSortIcon("reference")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Debit {getSortIcon("amount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Credit {getSortIcon("amount")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        {(() => {
                          const dateToUse = transaction.shipmentDate || transaction.createdAt;
                          try {
                            return format(parseISO(dateToUse), "dd-MM-yyyy");
                          } catch (e) {
                            return new Date(dateToUse).toLocaleDateString('en-GB');
                          }
                        })()}
                      </td>
                      <td className="px-4 py-3">{transaction.invoice || "-"}</td>
                      <td className="px-4 py-3">{transaction.description}</td>
                      <td className="px-4 py-3">{transaction.reference || "-"}</td>
                      <td className="px-4 py-3 font-medium">
                        {transaction.type === "DEBIT" ? (
                          <span className="text-red-600 dark:text-red-400">
                            PKR {transaction.amount.toLocaleString()}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {transaction.type === "CREDIT" ? (
                          <span className="text-green-600 dark:text-green-400">
                            PKR {transaction.amount.toLocaleString()}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            transaction.newBalance > 0
                              ? "text-red-600 dark:text-red-400"
                              : transaction.newBalance < 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          PKR {transaction.newBalance.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
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
    </div>
  );
}
