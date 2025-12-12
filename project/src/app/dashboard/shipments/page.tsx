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
import { Label } from "@/components/ui/label";
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
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Country } from "country-state-city";
import {
  format,
  parseISO,
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
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("All");
  const [deliveryStatuses, setDeliveryStatuses] = useState<{ id: number; name: string }[]>([]);
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
  const [sortField, setSortField] = useState<SortField>("invoiceNumber");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

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
          endDate = new Date(customEndDate);
          // Add one day to end date to include the selected end date
          endDate.setDate(endDate.getDate() + 1);
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
    // Fetch delivery statuses from settings
    const fetchDeliveryStatuses = async () => {
      try {
        const res = await fetch("/api/settings/deliveryStatus");
        const data = await res.json();
        if (Array.isArray(data)) {
          setDeliveryStatuses(data);
          
          // Set default filter: "In Transit" if found, otherwise "All"
          const inTransitStatus = data.find((status: { id: number; name: string }) => 
            status.name === "In Transit"
          );
          if (inTransitStatus) {
            setDeliveryStatusFilter("In Transit");
          } else {
            setDeliveryStatusFilter("All");
          }
        }
      } catch (error) {
        console.error("Error fetching delivery statuses:", error);
        // On error, default to "All"
        setDeliveryStatusFilter("All");
      }
    };

    fetchDeliveryStatuses();
  }, []);

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

  const getDeliveryStatusColor = (status: string | null) => {
    if (!status) return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "delivered":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200";
      case "in transit":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled":
      case "canceled":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200";
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

  const handleMarkAsDelivered = async (
    shipment: Shipment & { invoices: { status: string }[] }
  ) => {
    try {
      const res = await fetch("/api/update-shipment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: shipment.id,
          deliveryStatus: "Delivered",
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Shipment marked as delivered!");
        
        // Refresh the shipments list
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
      } else {
        toast.error(data.message || "Failed to update shipment status");
      }
    } catch (error) {
      console.error("Error marking shipment as delivered:", error);
      toast.error("Error updating shipment status");
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
    const baseHeaders = ["Date", "Receipt #", "Sender Name", "Receiver Name", "Destination", "Package", "Pcs", "Weight", "Tracking"];
    const headers = deliveryStatusFilter === "All" 
      ? [...baseHeaders, "Delivery Status", "Total Cost", "Invoice Status"]
      : [...baseHeaders, "Total Cost", "Invoice Status"];
    
    const data = shipments.map(shipment => {
      const baseData = [
        formatDate(shipment.shipmentDate || shipment.createdAt),
        shipment.invoiceNumber,
        shipment.senderName,
        shipment.recipientName,
        getCountryName(shipment.destination),
        shipment.packaging || "N/A",
        shipment.amount || 1,
        `${shipment.totalWeight || shipment.weight || 0}`,
        shipment.trackingId,
      ];
      
      if (deliveryStatusFilter === "All") {
        return [
          ...baseData,
          shipment.deliveryStatus || "N/A",
          `Rs. ${shipment.totalCost}`,
          shipment.invoices?.[0]?.status || shipment.invoiceStatus || "N/A"
        ];
      } else {
        return [
          ...baseData,
          `Rs. ${shipment.totalCost}`,
          shipment.invoices?.[0]?.status || shipment.invoiceStatus || "N/A"
        ];
      }
    });
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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0 min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white">
          📦 All Shipments
        </h2>
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Shipments</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        {/* Left side - Search field */}
        <div className="w-full lg:max-w-2xl">
          <div className="flex w-full max-w-sm">
            <Input
              placeholder="Search by invoice #, sender, receiver, destination, type, tracking..."
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
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end w-full lg:w-auto">
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
              onValueChange={(value: string) => {
                setPage(1);
                setDeliveryStatusFilter(value);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select delivery status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                {deliveryStatuses.map((status) => (
                  <SelectItem key={status.id} value={status.name}>
                    {status.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
        </div>
      </div>

      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {shipments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No shipments found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("shipmentDate")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Date</span>
                      <span className="sm:hidden">D</span>
                      {getSortIcon("shipmentDate")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Booking#</span>
                      <span className="sm:hidden">B</span>
                      {getSortIcon("invoiceNumber")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("senderName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Sender</span>
                      <span className="sm:hidden">S</span>
                      {getSortIcon("senderName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("recipientName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Receiver</span>
                      <span className="sm:hidden">R</span>
                      {getSortIcon("recipientName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("destination")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Destination</span>
                      <span className="sm:hidden">D</span>
                      {getSortIcon("destination")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("packaging")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Type</span>
                      <span className="sm:hidden">T</span>
                      {getSortIcon("packaging")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Pcs</span>
                      <span className="sm:hidden">P</span>
                      {getSortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalWeight")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Weight</span>
                      <span className="sm:hidden">W</span>
                      {getSortIcon("totalWeight")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("trackingId")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Tracking</span>
                      <span className="sm:hidden">T</span>
                      {getSortIcon("trackingId")}
                    </button>
                  </th>
                  {deliveryStatusFilter === "All" && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <span className="hidden sm:inline">Status</span>
                      <span className="sm:hidden">DS</span>
                    </th>
                  )}
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalCost")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Total Cost</span>
                      <span className="sm:hidden">C</span>
                      {getSortIcon("totalCost")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceStatus")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">Invoice Status</span>
                      <span className="sm:hidden">I</span>
                      {getSortIcon("invoiceStatus")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Actions</span>
                    <span className="sm:hidden">A</span>
                  </th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                  {shipments.map((shipment) => (
                    <motion.tr
                      key={shipment.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {formatDate(shipment.shipmentDate || shipment.createdAt)}
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-bold text-blue-600">
                        {shipment.invoiceNumber}
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{shipment.senderName}</span>
                        <span className="sm:hidden">{shipment.senderName?.substring(0, 10)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{shipment.recipientName}</span>
                        <span className="sm:hidden">{shipment.recipientName?.substring(0, 10)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{getCountryName(shipment.destination)}</span>
                        <span className="sm:hidden">{getCountryName(shipment.destination)?.substring(0, 8)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.packaging || "N/A"}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.amount || 1}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{shipment.totalWeight || shipment.weight || 0}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-bold text-purple-600">
                        <span className="hidden sm:inline">{shipment.trackingId}</span>
                        <span className="sm:hidden">{shipment.trackingId?.substring(0, 8)}...</span>
                      </td>
                      {deliveryStatusFilter === "All" && (
                        <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                          <span
                            className={`px-1 sm:px-2 py-1 rounded text-xs font-medium ${getDeliveryStatusColor(
                              shipment.deliveryStatus
                            )}`}
                          >
                            {shipment.deliveryStatus || "N/A"}
                          </span>
                        </td>
                      )}
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">Rs. {shipment.totalCost}</span>
                        <span className="sm:hidden">Rs.{shipment.totalCost}</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span
                          className={`px-1 sm:px-2 py-1 rounded text-xs font-medium ${getInvoiceColor(
                            shipment.invoices?.[0]?.status ||
                              shipment.invoiceStatus
                          )}`}
                        >
                          <span className="hidden sm:inline">
                            {shipment.invoices?.[0]?.status ||
                              shipment.invoiceStatus ||
                              "N/A"}
                          </span>
                          <span className="sm:hidden">
                            {shipment.invoices?.[0]?.status?.substring(0, 3) ||
                              shipment.invoiceStatus?.substring(0, 3) ||
                              "N/A"}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
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
                              onClick={() => handleMarkAsDelivered(shipment)}
                              className="text-green-600"
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Delivered
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(shipment)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Printer className="mr-2 h-4 w-4" />
                              Print Receipt
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
    </div>
  );
}
