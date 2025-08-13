"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Vendors } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Eye, EllipsisVertical, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Table } from "lucide-react";
import Link from "next/link";
import {Country as country}  from "country-state-city";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import DeleteDialog from "@/components/DeleteDialog";
import ViewVendorDialog from "@/components/ViewVendorDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";


const STATUSES = ["All", "Active", "Inactive"];
const SORT_OPTIONS = ["Newest", "Oldest"];

type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country" | "currentBalance";
type SortOrder = "asc" | "desc";

export default function VendorsPage() {
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendors[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [vendorToDelete, setVendorToDelete] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Default page size

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchVendors = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === 'all' ? 'all' : String(pageSize),
      ...(statusFilter !== "All" && { status: statusFilter }),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/vendors?${params}`);
    const { vendors, total } = await res.json();
    setVendors(vendors);
    setTotal(total);
  };

  useEffect(() => {
    fetchVendors();
  }, [page, statusFilter, searchTerm, sortField, sortOrder, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
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
          fontSize: 10,
          fontWeight: 'bold',
          color: '#ffffff',
        },
        tableCell: {
          margin: 'auto',
          marginTop: 5,
          fontSize: 10,
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

  const getVendorExportData = (vendors: any[]) => {
    const headers = ["ID", "Company Name", "Contact Person", "Phone", "City", "Country"];
    const data = vendors.map(vendor => [
      vendor.id,
      vendor.CompanyName,
      vendor.PersonName,
      vendor.Phone,
      vendor.City,
      country.getCountryByCode(vendor.Country)?.name || vendor.Country
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getVendorExportData(vendors);
    exportToExcel(data, headers, 'vendors');
  };

  const handleExportPrint = () => {
    const { headers, data } = getVendorExportData(vendors);
    exportToPrint(data, headers, 'Vendors Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getVendorExportData(vendors);
    exportToPDF(data, headers, 'Vendors Report', total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">All Vendors</h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Vendors</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        {/* Page size and Search bar */}
        <div className="flex items-center gap-4 w-full max-w-md">
          {/* Page size select */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(value === 'all' ? 'all' : parseInt(value));
                setPage(1); // Reset to first page when changing page size
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

          {/* Search bar with icon */}
          <div className="flex flex-1">
            {/* Search input */}
            <Input
              placeholder="Search by company name, person name, phone, city, or country"
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            {/* Icon box */}
            <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md">
              <Search className="text-white s w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Export and Add buttons */}
        <div className="flex gap-2">
                    {/* Export buttons */}
          <Button variant="outline" onClick={handleExportExcel} className="flex items-center gap-2">
            <Table className="w-4 h-4" />
            Excel
          </Button>
          <Button variant="outline" onClick={handleExportPrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button 
            variant="outline" 
            onClick={handleExportPDF} 
            disabled={isGeneratingPDF}
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {isGeneratingPDF ? 'Generating...' : 'PDF'}
          </Button>

          {/* Add Vendor button */}
          <Button asChild>
            <Link href="/dashboard/vendors/add-vendors">
              <Plus className="w-4 h-4 mr-2" />
              Add Vendors
            </Link>
          </Button>
        </div>
      </div>


      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {vendors.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">No vendors found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      ID {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("CompanyName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Company Name {getSortIcon("CompanyName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("PersonName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Contact Person {getSortIcon("PersonName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Phone")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Phone {getSortIcon("Phone")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("City")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      City {getSortIcon("City")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Country")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Country {getSortIcon("Country")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("currentBalance")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Balance {getSortIcon("currentBalance")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                  {vendors.map((vendor) => (
                    <motion.tr
                      key={vendor.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3 font-medium">{vendor.id}</td>
                      <td className="px-4 py-3">{vendor.CompanyName}</td>
                      <td className="px-4 py-3">{vendor.PersonName}</td>
                      <td className="px-4 py-3">{vendor.Phone}</td>
                      <td className="px-4 py-3">{vendor.City}</td>
                      <td className="px-4 py-3">{country.getCountryByCode(vendor.Country)?.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            vendor.currentBalance > 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : vendor.currentBalance < 0
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          ${vendor.currentBalance?.toLocaleString() || '0.00'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <EllipsisVertical />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-36">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`vendors/add-vendors?id=${vendor.id}`)
                              }
                            >
                              ✏️ Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setVendorToDelete(vendor);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              🗑️ Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedVendor(vendor);
                                setOpenViewDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                router.push(`/dashboard/accounts/transactions/vendor/${vendor.id}`);
                              }}
                            >
                              💰 Transactions
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Dialog
                          open={openDeleteDialog}
                          onOpenChange={setOpenDeleteDialog}
                        >
                          <DialogContent className="max-w-md w-full">
                            <DeleteDialog
                              entityType="vendor"
                              entityId={vendorToDelete?.id || 0}
                              onDelete={() => {
                                fetchVendors();
                                setVendorToDelete(null);
                              }}
                              onClose={() => {
                                setOpenDeleteDialog(false);
                                setVendorToDelete(null);
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

      {/* View Vendor Dialog */}
      <ViewVendorDialog
        vendor={selectedVendor}
        open={openViewDialog}
        onOpenChange={setOpenViewDialog}
      />

      {/* Pagination and Total Count */}
      <div className="mt-6 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
        <div>
          {pageSize === 'all' 
            ? `Showing all ${total} vendors`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} vendors`
          }
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
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
    </div>
  );
}
