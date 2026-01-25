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
  User, 
  Search, 
  Wallet,
  Table,
  ArrowUpDown,
  ArrowUp,
  Printer,
  FileText
} from "lucide-react";
import { useRouter } from "next/navigation";

type Vendor = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
  creditLimit: number;
};

type SortField = "id" | "companyName" | "balance";
type SortOrder = "asc" | "desc";

export default function VendorBalancesPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterAndSortVendors();
  }, [vendors, searchTerm, sortField, sortOrder]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vendors?limit=all');
      const data = await response.json();
      
      if (response.ok) {
        // API returns { vendors: [...], total: ... }
        const vendorsArray = Array.isArray(data.vendors) ? data.vendors : (Array.isArray(data) ? data : []);
        setVendors(vendorsArray);
        setFilteredVendors(vendorsArray);
      } else {
        setVendors([]);
        setFilteredVendors([]);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
      setVendors([]);
      setFilteredVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortVendors = () => {
    if (!Array.isArray(vendors)) {
      setFilteredVendors([]);
      return;
    }
    let filtered = [...vendors];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(v => 
        v.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.PersonName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.id.toString().includes(searchTerm)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "companyName":
          aValue = a.CompanyName.toLowerCase();
          bValue = b.CompanyName.toLowerCase();
          break;
        case "balance":
          aValue = a.currentBalance;
          bValue = b.currentBalance;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    setFilteredVendors(filtered);
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

  const totalBalance = Array.isArray(filteredVendors) ? filteredVendors.reduce((sum, v) => sum + (v.currentBalance || 0), 0) : 0;
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
                  `<td class="${idx >= 3 ? 'amount-cell' : ''}">${cell}</td>`
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
          width: '20%',
          borderStyle: 'solid',
          borderWidth: 1,
          backgroundColor: '#4a5568',
          padding: 8,
        },
        tableCol: {
          width: '20%',
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
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      (v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    exportToExcel(data, headers, 'vendor_balances');
  };

  const handleExportPrint = async () => {
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      (v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    await exportToPrint(data, headers, 'Vendor Balances Report');
  };

  const handleExportPDF = () => {
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      (v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    exportToPDF(data, headers, 'Vendor Balances Report');
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Vendor Balances Report
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View all vendors with their current account balances
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="flex gap-2 w-full sm:w-auto">
          <Input
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 sm:max-w-sm"
          />
        </div>

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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="w-4 h-4" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {totalBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-sm">Total Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {filteredVendors.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendors Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle>Vendor Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-10 text-gray-600 dark:text-gray-400">
              No vendors found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("id")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Vendor ID {getSortIcon("id")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("companyName")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Company Name {getSortIcon("companyName")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-left">Contact Person</th>
                    <th className="px-4 py-2 text-right">
                      <button
                        onClick={() => handleSort("balance")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Balance {getSortIcon("balance")}
                      </button>
                    </th>
                    <th className="px-4 py-2 text-right">Credit Limit</th>
                    <th className="px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">{vendor.id}</td>
                      <td className="px-4 py-3 font-medium">{vendor.CompanyName}</td>
                      <td className="px-4 py-3">{vendor.PersonName || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span
                          className={
                            vendor.currentBalance > 0
                              ? "text-red-600 dark:text-red-400"
                              : vendor.currentBalance < 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {vendor.currentBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {vendor.creditLimit.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/accounts/transactions/vendor/${vendor.id}`)}
                        >
                          View Transactions
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
