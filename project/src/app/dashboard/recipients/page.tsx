"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recipients } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, EllipsisVertical, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Table } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Country as country } from "country-state-city";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import DeleteDialog from "@/components/DeleteDialog";
import ViewRecipientDialog from "@/components/ViewRecipientDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";



type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country";
type SortOrder = "asc" | "desc";

export default function RecipientsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipients[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [recipientToDelete, setRecipientToDelete] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Default page size

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchRecipients = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === 'all' ? 'all' : String(pageSize),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/recipients?${params}`);
    const { recipients, total } = await res.json();
    setRecipients(recipients);
    setTotal(total);
  };

  useEffect(() => {
    fetchRecipients();
  }, [page, searchTerm, sortField, sortOrder, pageSize]);

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

  const getRecipientExportData = (recipients: any[]) => {
    const headers = ["ID", "Company Name", "Contact Person", "Phone", "City", "Country"];
    const data = recipients.map(recipient => [
      recipient.id,
      recipient.CompanyName,
      recipient.PersonName,
      recipient.Phone,
      recipient.City,
      country.getCountryByCode(recipient.Country)?.name || recipient.Country
    ]);
    return { headers, data };
  };

  const handleExportExcel = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToExcel(data, headers, 'recipients');
  };

  const handleExportPrint = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToPrint(data, headers, 'Recipients Report', total);
  };

  const handleExportPDF = () => {
    const { headers, data } = getRecipientExportData(recipients);
    exportToPDF(data, headers, 'Recipients Report', total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">
          All Recipients
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Recipients</div>
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

          {/* Add Recipient button */}
          <Button asChild>
            <Link href="/dashboard/recipients/add-recipients">
              <Plus className="w-4 h-4 mr-2" />
              Add Recipient
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {recipients.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No recipients found.
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
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                  {recipients.map((recipient) => (
                    <motion.tr
                      key={recipient.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3 font-medium">{recipient.id}</td>
                      <td className="px-4 py-3">{recipient.CompanyName}</td>
                      <td className="px-4 py-3">{recipient.PersonName}</td>
                      <td className="px-4 py-3">{recipient.Phone}</td>
                      <td className="px-4 py-3">{recipient.City}</td>
                      <td className="px-4 py-3">
                        {country.getCountryByCode(recipient.Country)?.name}
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
                                router.push(`recipients/add-recipients?id=${recipient.id}`)
                              }
                            >
                              ✏️ Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRecipientToDelete(recipient);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              🗑️ Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setOpenViewDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Dialog
                          open={openDeleteDialog}
                          onOpenChange={setOpenDeleteDialog}
                        >
                          <DialogContent className="max-w-md w-full">
                            <DeleteDialog
                              entityType="recipient"
                              entityId={recipientToDelete?.id || 0}
                              onDelete={() => {
                                fetchRecipients();
                                setRecipientToDelete(null);
                              }}
                              onClose={() => {
                                setOpenDeleteDialog(false);
                                setRecipientToDelete(null);
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

      {/* View Recipient Dialog */}
      <ViewRecipientDialog
        recipient={selectedRecipient}
        open={openViewDialog}
        onOpenChange={setOpenViewDialog}
      />

      {/* Pagination and Total Count */}
      <div className="mt-6 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
        <div>
          {pageSize === 'all' 
            ? `Showing all ${total} recipients`
            : `Showing ${((page - 1) * (pageSize as number)) + 1} to ${Math.min(page * (pageSize as number), total)} of ${total} recipients`
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
