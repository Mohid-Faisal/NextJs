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
  Calendar, 
  TrendingDown,
  Download,
  Printer,
  FileText,
  Table,
  ArrowUp
} from "lucide-react";
import { format, parseISO } from "date-fns";

type Vendor = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
  creditLimit: number;
};

export default function AccountsPayablePage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [periodType, setPeriodType] = useState<'month' | 'last3month' | 'last6month' | 'year' | 'all'>('all');
  const [dateRange, setDateRange] = useState<{ from: Date; to?: Date } | undefined>(undefined);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    filterVendors();
  }, [vendors, searchTerm, periodType, dateRange]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/vendors?limit=all');
      const data = await response.json();
      
      if (response.ok) {
        // API returns { vendors: [...], total: ... }
        const vendorsArray = Array.isArray(data.vendors) ? data.vendors : (Array.isArray(data) ? data : []);
        
        // Filter vendors with negative balance (we owe them)
        // Negative balance means we owe vendor money
        const payableVendors = vendorsArray.filter((v: Vendor) => {
          const balance = Number(v.currentBalance) || 0;
          return balance > 0; // Negative balance = we owe them
        });
        setVendors(payableVendors);
        setFilteredVendors(payableVendors);
      } else {
        console.error('Accounts Payable - API error:', data);
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

  const filterVendors = () => {
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

    setFilteredVendors(filtered);
  };

  // For accounts payable, negative balance means we owe them, so we sum the absolute values
  const totalPayable = Array.isArray(filteredVendors) 
    ? Math.abs(filteredVendors.reduce((sum, v) => sum + (v.currentBalance || 0), 0))
    : 0;

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
    }
  };

  const handleExportExcel = () => {
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      Math.abs(v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    exportToExcel(data, headers, 'accounts_payable');
  };

  const handleExportPrint = async () => {
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      Math.abs(v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    await exportToPrint(data, headers, 'Accounts Payable Report');
  };

  const handleExportPDF = () => {
    const headers = ["Vendor ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredVendors.map(v => [
      v.id,
      v.CompanyName,
      v.PersonName || "-",
      Math.abs(v.currentBalance || 0).toLocaleString(),
      (v.creditLimit || 0).toLocaleString()
    ]);
    exportToPDF(data, headers, 'Accounts Payable Report');
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Accounts Payable Report
        </h1>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          View all vendors with outstanding balances (amounts we owe)
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

        <div className="flex gap-4 items-end">
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
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

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
              <DropdownMenuItem onClick={handleExportPDF} className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Total Accounts Payable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600 dark:text-red-400">
            {totalPayable.toLocaleString()}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} with outstanding balances
          </p>
        </CardContent>
      </Card>

      {/* Vendors Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle>Vendors with Outstanding Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-10 text-gray-600 dark:text-gray-400">
              No vendors with outstanding balances found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">Vendor ID</th>
                    <th className="px-4 py-2 text-left">Company Name</th>
                    <th className="px-4 py-2 text-left">Contact Person</th>
                    <th className="px-4 py-2 text-right">Outstanding Balance</th>
                    <th className="px-4 py-2 text-right">Credit Limit</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">{vendor.id}</td>
                      <td className="px-4 py-3 font-medium">{vendor.CompanyName}</td>
                      <td className="px-4 py-3">{vendor.PersonName || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">
                        {Math.abs(vendor.currentBalance || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {vendor.creditLimit.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={3} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right text-red-600 dark:text-red-400">
                      {totalPayable.toLocaleString()}
                    </td>
                    <td></td>
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
