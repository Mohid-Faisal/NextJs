"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Customers } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Plus, EllipsisVertical, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Table } from "lucide-react";
import Link from "next/link";
import { Country as country } from "country-state-city";
import { useRouter } from "next/navigation";
import DeleteDialog from "@/components/DeleteDialog";
import ViewCustomerDialog from "@/components/ViewCustomerDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const STATUSES = ["All", "Active", "Inactive"];

type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country" | "ActiveStatus" | "currentBalance";
type SortOrder = "asc" | "desc";

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customers[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Default page size

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchCustomers = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === 'all' ? 'all' : String(pageSize),
      ...(statusFilter !== "All" && { status: statusFilter }),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/customers?${params}`);
    const { customers, total } = await res.json();
    setCustomers(customers);
    setTotal(total);
  };

  useEffect(() => {
    fetchCustomers();
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
          width: '14.28%',
          borderStyle: 'solid',
          borderWidth: 1,
          borderLeftWidth: 0,
          borderTopWidth: 0,
          borderColor: '#bfbfbf',
          backgroundColor: '#4285f4',
        },
        tableCol: {
          width: '14.28%',
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

  const getCustomerExportData = (customers: any[]) => {
    const headers = ["ID", "Company Name", "Contact Person", "Phone", "City", "Country", "Status"];
    const data = customers.map(customer => [
      customer.id,
      customer.CompanyName,
      customer.PersonName,
      customer.Phone,
      customer.City,
      country.getCountryByCode(customer.Country)?.name || customer.Country,
      customer.ActiveStatus
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getCustomerExportData(customers);
    exportToExcel(data, headers, 'customers');
  };

  const handleExportPrint = () => {
    const { headers, data } = getCustomerExportData(customers);
    exportToPrint(data, headers, 'Customers Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getCustomerExportData(customers);
    exportToPDF(data, headers, 'Customers Report', total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">
          All Customers
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Customers</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center w-full gap-4">

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

        {/* Status filter */}
        <div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setPage(1);
              setStatusFilter(value);
            }}
          >
            <SelectTrigger id="status" className="w-[160px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Search bar */}
        <div className="flex w-full max-w-sm">
          <Input
            placeholder="Search by company name, person name, phone, city, or country"
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

        {/* Export and Add buttons */}
        <div className="ml-auto flex gap-2">
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

          {/* Add Customer button */}
          <Button asChild>
            <Link href="/dashboard/customers/add-customers">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Link>
          </Button>
        </div>
      </div>

      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {customers.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No customers found.
            </p>
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
                      onClick={() => handleSort("ActiveStatus")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Status {getSortIcon("ActiveStatus")}
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
                  {customers.map((customer) => (
                    <motion.tr
                      key={customer.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3 font-medium">{customer.id}</td>
                      <td className="px-4 py-3">{customer.CompanyName}</td>
                      <td className="px-4 py-3">{customer.PersonName}</td>
                      <td className="px-4 py-3">{customer.Phone}</td>
                      <td className="px-4 py-3">{customer.City}</td>
                      <td className="px-4 py-3">
                        {country.getCountryByCode(customer.Country)?.name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            customer.ActiveStatus === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {customer.ActiveStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            customer.currentBalance > 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : customer.currentBalance < 0
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          ${customer.currentBalance?.toLocaleString() || '0.00'}
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
                                router.push(`customers/add-customers?id=${customer.id}`)
                              }
                            >
                              ✏️ Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCustomerToDelete(customer);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              🗑️ Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCustomer(customer);
                                setOpenViewDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                router.push(`/dashboard/accounts/transactions/customer/${customer.id}`);
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
                              entityType="customer"
                              entityId={customerToDelete?.id || 0}
                              onDelete={() => {
                                fetchCustomers();
                                setCustomerToDelete(null);
                              }}
                              onClose={() => {
                                setOpenDeleteDialog(false);
                                setCustomerToDelete(null);
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

      {/* View Customer Dialog */}
      <ViewCustomerDialog
        customer={selectedCustomer}
        open={openViewDialog}
        onOpenChange={setOpenViewDialog}
      />

      {/* Pagination and Total Count */}
      <div className="mt-6 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
        <div>
          {pageSize === 'all' 
            ? `Showing all ${total} customers`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} customers`
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
