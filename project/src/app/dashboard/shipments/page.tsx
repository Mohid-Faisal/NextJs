"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shipment } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  FileText,
  Table,
} from "lucide-react";
import { Country } from "country-state-city";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DeleteDialog from "@/components/DeleteDialog";

const LIMIT = 10;

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<
    (Shipment & { invoices: { status: string }[] })[]
  >([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("Processing");
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

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<
    (Shipment & { invoices: { status: string }[] }) | null
  >(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const totalPages = Math.ceil(total / LIMIT);
  type SortField =
    | "trackingId"
    | "invoiceNumber"
    | "shipmentDate"
    | "senderName"
    | "recipientName"
    | "destination"
    | "totalCost"
    | "invoiceStatus"
    | "packaging"
    | "amount"
    | "totalWeight";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("shipmentDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    const fetchShipments = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(searchTerm && { search: searchTerm }),
        ...(deliveryStatusFilter !== "All" && { status: deliveryStatusFilter }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField,
        sortOrder,
      });

      const res = await fetch(`/api/shipments?${params}`);
      const { shipments, total } = await res.json();
      setShipments(shipments);
      setTotal(total);
    };

    fetchShipments();
  }, [page, searchTerm, deliveryStatusFilter, dateRange, sortField, sortOrder]);

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

  const getInvoiceColor = (status: string | null) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200";
      case "Unpaid":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200";
      case "Overdue":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  // Function to get country name from country code
  const getCountryName = (countryCode: string | null) => {
    if (!countryCode) return "N/A";

    try {
      const countries = Country.getAllCountries();
      const country = countries.find(
        (c) => c.isoCode === countryCode || c.name === countryCode
      );
      return country ? country.name : countryCode;
    } catch (error) {
      console.error("Error converting country code:", error);
      return countryCode;
    }
  };

  // Function to format date from createdAt
  const formatDate = (dateString: string | Date) => {
    try {
      const date =
        typeof dateString === "string" ? parseISO(dateString) : dateString;
      return format(date, "MMM dd, yyyy");
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

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

  const handleEdit = (
    shipment: Shipment & { invoices: { status: string }[] }
  ) => {
    // Redirect to add-shipment with id to enable edit mode and prefill
    window.location.href = `/dashboard/add-shipment?id=${shipment.id}`;
  };

  const handleDelete = async (
    shipment: Shipment & { invoices: { status: string }[] }
  ) => {
    setShipmentToDelete(shipment);
    setOpenDeleteDialog(true);
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
      console.log('Starting PDF generation...');
      
      // Use @react-pdf/renderer for PDF generation
      const { Document, Page, Text, View, StyleSheet, pdf } = await import('@react-pdf/renderer');
      
      // Create styles
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
          width: '8.33%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
          backgroundColor: '#4285f4',
        },
        tableCol: {
          width: '8.33%',
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

      // Create PDF document
      const MyDocument = () => {
        return (
          <Document>
            <Page size="A4" style={styles.page}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>Total: {total}</Text>
              <Text style={styles.subtitle}>Generated on: {new Date().toLocaleDateString()}</Text>
              
              <View style={styles.table}>
                {/* Header Row */}
                <View style={styles.tableRow}>
                  {headers.map((header, index) => (
                    <View key={index} style={styles.tableColHeader}>
                      <Text style={styles.tableCellHeader}>{header}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Data Rows */}
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

      // Generate and download PDF
      const blob = await pdf(<MyDocument />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log('PDF generated successfully using @react-pdf/renderer');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name
      });
      alert(`Error generating PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getShipmentExportData = (shipments: any[]) => {
    const headers = ["Date", "Receipt #", "Sender Name", "Receiver Name", "Destination", "Package", "Pcs", "Weight", "Tracking", "Total Cost", "Invoice Status"];
    const data = shipments.map(shipment => [
      formatDate(shipment.shipmentDate || shipment.createdAt),
      shipment.invoiceNumber,
      shipment.senderName,
      shipment.recipientName,
      getCountryName(shipment.destination),
      shipment.packaging || "N/A",
      shipment.amount || 1,
      `${shipment.totalWeight || shipment.weight || 0}`,
      shipment.trackingId,
      `Rs. ${shipment.totalCost}`,
      shipment.invoices?.[0]?.status || shipment.invoiceStatus || "N/A"
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getShipmentExportData(shipments);
    exportToExcel(data, headers, 'shipments');
  };

  const handleExportPrint = () => {
    const { headers, data } = getShipmentExportData(shipments);
    exportToPrint(data, headers, 'Shipments Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getShipmentExportData(shipments);
    exportToPDF(data, headers, 'Shipments Report', total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">
        📦 All Shipments
      </h2>

      {/* Filters */}
      <div className="mb-6 flex justify-between items-end gap-4">
        {/* Left side - Search field */}
        <div>
          <div className="flex w-full max-w-sm">
            <Input
              placeholder="Search all fields (AWB, tracking, sender, receiver, destination, etc.)"
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

        {/* Right side - Export, Delivery Status and Date Range */}
        <div className="flex gap-4 items-end">
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

          {/* Delivery Status Filter */}
          <div>
            <Select
              value={deliveryStatusFilter}
              onValueChange={(value) => {
                setPage(1);
                setDeliveryStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select delivery status" />
              </SelectTrigger>
              <SelectContent>
                {["All", "Processing", "Delivered", "Cancelled"].map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {shipments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No shipments found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("shipmentDate")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Date {getSortIcon("shipmentDate")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Receipt {getSortIcon("invoiceNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("senderName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Sender {getSortIcon("senderName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("recipientName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Receiver {getSortIcon("recipientName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("destination")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Destination {getSortIcon("destination")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("packaging")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Type {getSortIcon("packaging")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Pcs {getSortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalWeight")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Weight {getSortIcon("totalWeight")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("trackingId")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Tracking {getSortIcon("trackingId")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalCost")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Total Cost {getSortIcon("totalCost")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceStatus")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Invoice Status {getSortIcon("invoiceStatus")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                  {shipments.map((shipment) => (
                    <motion.tr
                      key={shipment.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3">
                        {formatDate(shipment.shipmentDate || shipment.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium text-blue-600">
                        {shipment.invoiceNumber}
                      </td>
                      <td className="px-4 py-3">{shipment.senderName}</td>
                      <td className="px-4 py-3">{shipment.recipientName}</td>
                      <td className="px-4 py-3">
                        {getCountryName(shipment.destination)}
                      </td>
                      <td className="px-4 py-3">{shipment.packaging || "N/A"}</td>
                      <td className="px-4 py-3">{shipment.amount || 1}</td>
                      <td className="px-4 py-3">{shipment.totalWeight || shipment.weight || 0}</td>
                      <td className="px-4 py-3 font-medium">
                        {shipment.trackingId}
                      </td>
                      <td className="px-4 py-3">Rs. {shipment.totalCost}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getInvoiceColor(
                            shipment.invoices?.[0]?.status ||
                              shipment.invoiceStatus
                          )}`}
                        >
                          {shipment.invoices?.[0]?.status ||
                            shipment.invoiceStatus ||
                            "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => handleEdit(shipment)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                window.location.href = `/dashboard/shipments/${shipment.id}`;
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(shipment)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="max-w-md w-full">
          <DeleteDialog
            entityType="shipment"
            entityId={shipmentToDelete?.id || 0}
            onDelete={async () => {
              const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
                ...(searchTerm && { search: searchTerm }),
                ...(deliveryStatusFilter !== "All" && { status: deliveryStatusFilter }),
                                                                  ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
                                 ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
                sortField,
                sortOrder,
              });
              const refreshRes = await fetch(`/api/shipments?${params}`);
              const { shipments, total } = await refreshRes.json();
              setShipments(shipments);
              setTotal(total);
              setShipmentToDelete(null);
            }}
            onClose={() => {
              setOpenDeleteDialog(false);
              setShipmentToDelete(null);
            }}
          />
        </DialogContent>
      </Dialog>

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
