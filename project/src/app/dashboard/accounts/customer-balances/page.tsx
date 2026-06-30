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

type Customer = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
  creditLimit: number;
};

type SortField = "id" | "companyName" | "balance";
type SortOrder = "asc" | "desc";

export default function CustomerBalancesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("balance");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    filterAndSortCustomers();
  }, [customers, searchTerm, sortField, sortOrder]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customers?limit=all');
      const data = await response.json();
      
      if (response.ok) {
        // API returns { customers: [...], total: ... }
        const customersArray = Array.isArray(data.customers) ? data.customers : (Array.isArray(data) ? data : []);
        setCustomers(customersArray);
        setFilteredCustomers(customersArray);
      } else {
        setCustomers([]);
        setFilteredCustomers([]);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCustomers = () => {
    if (!Array.isArray(customers)) {
      setFilteredCustomers([]);
      return;
    }
    let filtered = [...customers];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.PersonName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toString().includes(searchTerm)
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

    setFilteredCustomers(filtered);
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

  const totalBalance = Array.isArray(filteredCustomers) ? filteredCustomers.reduce((sum, c) => sum + (c.currentBalance || 0), 0) : 0;
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
    const headers = ["Customer ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredCustomers.map(c => [
      c.id,
      c.CompanyName,
      c.PersonName || "-",
      (c.currentBalance || 0).toLocaleString(),
      (c.creditLimit || 0).toLocaleString()
    ]);
    exportToExcel(data, headers, 'customer_balances');
  };

  const handleExportPrint = async () => {
    const headers = ["Customer ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredCustomers.map(c => [
      c.id,
      c.CompanyName,
      c.PersonName || "-",
      (c.currentBalance || 0).toLocaleString(),
      (c.creditLimit || 0).toLocaleString()
    ]);
    await exportToPrint(data, headers, 'Customer Balances Report');
  };

  const handleExportPDF = () => {
    const headers = ["Customer ID", "Company Name", "Contact Person", "Balance", "Credit Limit"];
    const data = filteredCustomers.map(c => [
      c.id,
      c.CompanyName,
      c.PersonName || "-",
      (c.currentBalance || 0).toLocaleString(),
      (c.creditLimit || 0).toLocaleString()
    ]);
    exportToPDF(data, headers, 'Customer Balances Report');
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <Wallet className="w-8 sm:w-10 h-8 sm:h-10 text-blue-600" />
            Customer Balances Report
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View all customers with their current account balances
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Showing current balances for all customers
          </p>
        </div>

        {/* Read-only stats tabs on the top right */}
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <div className="px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center min-w-[130px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shadow-sm border border-gray-150/40">
            <span className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-300">
              {filteredCustomers.length}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mt-0.5">
              Total Customers
            </span>
          </div>
          <div className="px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center min-w-[130px] bg-blue-50 dark:bg-blue-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm border border-gray-150/40">
            <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-300">
              ${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-300 mt-0.5">
              Total Balance
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        {/* Left side - Search bar */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
          <Input
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 text-sm rounded-lg"
          />
        </div>

        {/* Export Button */}
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="w-[110px] justify-between bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 text-xs font-semibold">
                Export
                <ArrowUp className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[110px]">
              <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2 text-xs">
                <Table className="w-3.5 h-3.5" />
                Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPrint} className="flex items-center gap-2 text-xs">
                <Printer className="w-3.5 h-3.5" />
                Print
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={handleExportPDF} 
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 text-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                {isGeneratingPDF ? 'Generating...' : 'PDF'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Customers Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle>Customer Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-10 text-gray-600 dark:text-gray-400">
              No customers found.
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
                        Customer ID {getSortIcon("id")}
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
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">{customer.id}</td>
                      <td className="px-4 py-3 font-medium">{customer.CompanyName}</td>
                      <td className="px-4 py-3">{customer.PersonName || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span
                          className={
                            customer.currentBalance > 0
                              ? "text-red-600 dark:text-red-400"
                              : customer.currentBalance < 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          {customer.currentBalance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {customer.creditLimit.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/dashboard/accounts/transactions/customer/${customer.id}`)}
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
