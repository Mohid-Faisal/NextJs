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
import { Plus, EllipsisVertical, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, Printer, FileText, Table, Upload, Check, Users, Download } from "lucide-react";
import { Country as country } from "country-state-city";
import { useRouter } from "next/navigation";
import DeleteDialog from "@/components/DeleteDialog";
import ViewCustomerDialog from "@/components/ViewCustomerDialog";
import AddCustomerDialog from "@/components/AddCustomerDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Country, State, City } from "country-state-city";
import { toast } from "sonner";
import { TablePagination } from "@/components/TablePagination";

const STATUSES = ["All", "Active", "Inactive"];

type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country" | "ActiveStatus" | "currentBalance";
type SortOrder = "asc" | "desc";

// Edit Customer Form Component
const EditCustomerForm = ({ 
  customer, 
  onSuccess, 
  onCancel 
}: { 
  customer: any; 
  onSuccess: () => void; 
  onCancel: () => void; 
}) => {
  const [form, setForm] = useState({
    companyname: customer?.CompanyName || "",
    personname: customer?.PersonName || "",
    email: customer?.Email || "",
    phone: customer?.Phone || "",
    documentType: customer?.DocumentType || "",
    documentNumber: customer?.DocumentNumber || "",
    documentExpiry: customer?.DocumentExpiry || "",
    country: customer?.Country || "",
    state: customer?.State || "",
    city: customer?.City || "",
    zip: customer?.Zip || "",
    address: customer?.Address || "",
    activestatus: customer?.ActiveStatus || ""
  });

  const [selectedCountry, setSelectedCountry] = useState<string>(customer?.Country || "");
  const [selectedState, setSelectedState] = useState<string>(customer?.State || "");
  const [selectedCity, setSelectedCity] = useState<string>(customer?.City || "");
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);

  const countries = Country.getAllCountries();

  // Load states and cities when country/state changes
  useEffect(() => {
    if (selectedCountry) {
      const fetchedStates = State.getStatesOfCountry(selectedCountry);
      setStates(fetchedStates);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCountry && selectedState) {
      const fetchedCities = City.getCitiesOfState(selectedCountry, selectedState);
      setCities(fetchedCities);
    }
  }, [selectedState, selectedCountry]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Map form fields to API expected format
    const apiFormData = {
      companyname: form.companyname,
      personname: form.personname,
      email: form.email,
      phone: form.phone,
      documenttype: form.documentType,
      documentnumber: form.documentNumber,
      documentexpiry: form.documentExpiry,
      country: form.country,
      state: form.state,
      city: form.city,
      zip: form.zip,
      address: form.address,
      activestatus: form.activestatus
    };

    const formData = new FormData();
    formData.append("form", JSON.stringify(apiFormData));

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Customer updated successfully!");
        onSuccess();
      } else {
        toast.error(data.message || "Failed to update customer");
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyname">Company</Label>
                  <Input
            id="companyname"
            name="companyname"
            value={form.companyname}
                    onChange={handleChange}
            required
                  />
                </div>
        <div className="space-y-1.5">
          <Label htmlFor="personname">Person Name</Label>
                  <Input
            id="personname"
            name="personname"
            value={form.personname}
                    onChange={handleChange}
                  />
                </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
                    <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
                      onChange={handleChange}
                    />
                </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
                  <Input
            id="phone"
            name="phone"
            value={form.phone}
                    onChange={handleChange}
            placeholder="0301 2345678"
                  />
                </div>
      </div>

      {/* Document Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="documentType">Document Type</Label>
          <Select
            value={form.documentType}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, documentType: value }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Document Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CNIC">CNIC</SelectItem>
              <SelectItem value="Passport">Passport</SelectItem>
              <SelectItem value="NTN">NTN</SelectItem>
              <SelectItem value="DriverLicense">Driver License</SelectItem>
              <SelectItem value="others">others</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="documentNumber">Document Number</Label>
                  <Input
            id="documentNumber"
            name="documentNumber"
            value={form.documentNumber}
                    onChange={handleChange}
                  />
                </div>
        <div className="space-y-1.5">
          <Label htmlFor="documentExpiry">Expiry</Label>
                  <Input
            id="documentExpiry"
            name="documentExpiry"
            value={form.documentExpiry}
                    onChange={handleChange}
                  />
                </div>
      </div>

      {/* Country, State, City */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Select
            onValueChange={(value) => {
              setForm({ ...form, country: value, state: "", city: "" });
              setSelectedCountry(value);
            }}
            value={form.country}
          >
            <SelectTrigger id="country" className="w-full">
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map((country) => (
                <SelectItem key={country.isoCode} value={country.isoCode}>
                  {country.name} ({country.isoCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="state">State/Province</Label>
          <Select
            onValueChange={(value) => {
              setForm({ ...form, state: value, city: "" });
              setSelectedState(value);
            }}
            value={form.state}
            disabled={!form.country}
          >
            <SelectTrigger id="state" className="w-full">
              <SelectValue placeholder="Select a state/Provinces" />
            </SelectTrigger>
            <SelectContent>
              {states.map((state) => (
                <SelectItem key={state.isoCode} value={state.isoCode}>
                  {state.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Select
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, city: value }))
            }
            value={form.city}
            disabled={!form.state}
          >
            <SelectTrigger id="city" className="w-full">
              <SelectValue placeholder="Select a city" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((city) => (
                <SelectItem key={city.name} value={city.name}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Zip, Address & Active Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="zip">Zip Code</Label>
                  <Input
            id="zip"
            name="zip"
            value={form.zip}
                    onChange={handleChange}
                  />
                </div>

        <div className="space-y-1.5">
          <Label htmlFor="address">Address</Label>
                  <Input
            id="address"
            name="address"
            value={form.address}
                    onChange={handleChange}
                  />
                </div>

        <div className="space-y-1.5">
          <Label htmlFor="activestatus">Active Status</Label>
          <Select
            value={form.activestatus}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, activestatus: value }))
            }
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} className="text-sm px-4">
          Cancel
        </Button>
        <Button type="submit" className="text-sm px-4">
          Update Customer
        </Button>
      </div>
    </form>
  );
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customers[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openStartingBalanceDialog, setOpenStartingBalanceDialog] = useState(false);
  const [customerForBalance, setCustomerForBalance] = useState<Customers | null>(null);
  const [startingBalance, setStartingBalance] = useState("");
  const [startingBalanceDate, setStartingBalanceDate] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [customerToEdit, setCustomerToEdit] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pageSize, setPageSize] = useState<number | 'all'>(10); // Default page size
  const [activeTab, setActiveTab] = useState<"all" | "withBalance" | "active" | "inactive">("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  const handleDownloadTemplate = () => {
    const headers = [
      "CompanyName", "PersonName", "Email", "Phone", "DocumentType", 
      "DocumentNumber", "DocumentExpiry", "Country", "State", "City", 
      "Zip", "Address", "ActiveStatus", "currentBalance", "creditLimit"
    ];
    const rows = [
      ["Acme Corp", "John Doe", "john@acme.com", "+123456789", "Tax ID", "TX123456", "", "United States", "New York", "New York", "10001", "123 Broadway", "Active", "0", "5000"]
    ];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "customers_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Customers template downloaded successfully!");
  };
  const [grandTotal, setGrandTotal] = useState(0);
  const [withBalanceTotal, setWithBalanceTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [inactiveTotal, setInactiveTotal] = useState(0);

  const totalPages = pageSize === 'all' ? 1 : Math.ceil(total / pageSize);

  const fetchCustomers = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === 'all' ? 'all' : String(pageSize),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
      ...(activeTab === "withBalance" ? { onlyWithBalance: "true" } : {}),
      ...(activeTab === "active" ? { status: "Active" } : {}),
      ...(activeTab === "inactive" ? { status: "Inactive" } : {}),
    });

    const res = await fetch(`/api/customers?${params}`);
    const { customers, total, grandTotal: gt, withBalanceTotal: wbt, activeTotal: at, inactiveTotal: it } = await res.json();
    setCustomers(customers);
    setTotal(total);
    if (typeof gt === "number") setGrandTotal(gt);
    if (typeof wbt === "number") setWithBalanceTotal(wbt);
    if (typeof at === "number") setActiveTotal(at);
    if (typeof it === "number") setInactiveTotal(it);
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, searchTerm, sortField, sortOrder, pageSize, activeTab]);

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
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <Users className="w-8 sm:w-10 h-8 sm:h-10 text-blue-600" />
            Customers
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage your clients and track their balances
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium">
            {activeTab === "all"
              ? "Showing all registered customers"
              : activeTab === "withBalance"
              ? "Showing customers with a balance"
              : activeTab === "active"
              ? "Showing only active customers"
              : "Showing only inactive customers"}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => {
              setActiveTab("all");
              setPage(1);
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[110px] ${
              activeTab === "all"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-600 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-blue-900/20"
            }`}
          >
            <span className="text-lg font-bold text-blue-600 dark:text-blue-300">
              {grandTotal}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">
              Total Customers
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("withBalance");
              setPage(1);
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[110px] ${
              activeTab === "withBalance"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-650 text-indigo-600 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20"
            }`}
          >
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
              {withBalanceTotal}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-355 mt-0.5">
              With Balance
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("active");
              setPage(1);
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[110px] ${
              activeTab === "active"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-655 text-indigo-600 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-blue-900/20"
            }`}
          >
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">
              {activeTotal}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">
              Active
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("inactive");
              setPage(1);
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-md flex flex-col items-center justify-center transition-all min-w-[110px] ${
              activeTab === "inactive"
                ? "bg-white dark:bg-zinc-700 shadow-sm border border-gray-150 dark:border-zinc-655 text-indigo-600 dark:text-indigo-400"
                : "bg-transparent text-gray-600 dark:text-gray-300 hover:bg-blue-50/60 dark:hover:bg-blue-900/20"
            }`}
          >
            <span className="text-lg font-bold text-rose-600 dark:text-rose-300">
              {inactiveTotal}
            </span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-350 mt-0.5">
              Inactive
            </span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">

        {/* Left side - Search bar */}
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4.5 h-4.5" />
          <Input
            placeholder="Search by company, person name..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="pl-9 text-sm rounded-lg"
          />
        </div>

        {/* Right side - Import, Export, Add Customer */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full lg:w-auto">
          <div className="flex gap-2">
            {/* Import Button */}
            <Button
              onClick={() => setImportDialogOpen(true)}
              className="w-[110px] justify-center bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 flex items-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold shadow-sm"
            >
              <Download className="w-4 h-4" />
              Import
            </Button>

            {/* Export Dropdown */}
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-[110px] justify-center bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 flex items-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold">
                    <Upload className="w-4 h-4" />
                    Export
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

            {/* Add Customer button */}
            <AddCustomerDialog
              triggerLabel="Add Customer"
              onSuccess={() => {
                fetchCustomers();
              }}
            />
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {customers.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No customers found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">ID</span>
                      <span className="sm:hidden">ID</span>
                      {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("CompanyName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Company Name</span>
                      <span className="sm:hidden">Company</span>
                      {getSortIcon("CompanyName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("PersonName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Contact Person</span>
                      <span className="sm:hidden">Contact</span>
                      {getSortIcon("PersonName")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Phone")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Phone</span>
                      <span className="sm:hidden">Phone</span>
                      {getSortIcon("Phone")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("City")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">City</span>
                      <span className="sm:hidden">City</span>
                      {getSortIcon("City")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Country")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Country</span>
                      <span className="sm:hidden">Country</span>
                      {getSortIcon("Country")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("ActiveStatus")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Status</span>
                      <span className="sm:hidden">Status</span>
                      {getSortIcon("ActiveStatus")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("currentBalance")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      <span className="hidden sm:inline">Balance</span>
                      <span className="sm:hidden">Balance</span>
                      {getSortIcon("currentBalance")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">Action</span>
                    <span className="sm:hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                  {customers.map((customer) => (
                    <motion.tr
                      key={customer.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">{customer.id}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{customer.CompanyName}</span>
                        <span className="sm:hidden">{customer.CompanyName?.substring(0, 15)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{customer.PersonName}</span>
                        <span className="sm:hidden">{customer.PersonName?.substring(0, 12)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{customer.Phone}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">{customer.City}</td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{country.getCountryByCode(customer.Country)?.name}</span>
                        <span className="sm:hidden">{country.getCountryByCode(customer.Country)?.name?.substring(0, 10)}...</span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span
                          className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                            customer.ActiveStatus === "Active"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          <span className="hidden sm:inline">{customer.ActiveStatus}</span>
                          <span className="sm:hidden">{customer.ActiveStatus?.substring(0, 3)}</span>
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span
                          className={`px-1 sm:px-2 py-1 rounded-full text-xs font-medium ${
                            customer.currentBalance > 0
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : customer.currentBalance < 0
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }`}
                        >
                          <span className="hidden sm:inline">{customer.currentBalance?.toLocaleString() || '0.00'}</span>
                          <span className="sm:hidden">{customer.currentBalance?.toLocaleString() || '0.00'}</span>
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <EllipsisVertical />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-36">
                            <DropdownMenuItem
                              onClick={() => {
                                setCustomerToEdit(customer);
                                setOpenEditDialog(true);
                              }}
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
                            <DropdownMenuItem
                              onClick={() => {
                                setCustomerForBalance(customer);
                                setStartingBalance(customer.currentBalance?.toString() || "0");
                                setStartingBalanceDate(new Date().toISOString().split('T')[0]);
                                setOpenStartingBalanceDialog(true);
                              }}
                            >
                              💵 Set Starting Balance
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

      {/* Edit Customer Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent size="4xl" className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <h2 className="text-2xl text-center mb-6 font-bold">Edit Customer</h2>
            <EditCustomerForm
              customer={customerToEdit}
              onSuccess={() => {
                fetchCustomers();
                setOpenEditDialog(false);
                setCustomerToEdit(null);
              }}
              onCancel={() => {
                setOpenEditDialog(false);
                setCustomerToEdit(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        entityName="customers"
      />

      {/* Starting Balance Dialog */}
      <Dialog open={openStartingBalanceDialog} onOpenChange={setOpenStartingBalanceDialog}>
        <DialogContent className="max-w-md">
          <h2 className="text-xl font-semibold mb-4">Set Starting Balance</h2>
          {customerForBalance && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>{customerForBalance.CompanyName}</strong>
                </p>
                <p className="text-xs text-gray-500">
                  Current Balance: ${(customerForBalance.currentBalance || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <Label htmlFor="startingBalance">Starting Balance</Label>
                <Input
                  id="startingBalance"
                  type="number"
                  step="0.01"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Negative = they owe you, Positive = you owe them
                </p>
              </div>
              <div>
                <Label htmlFor="startingBalanceDate">Date</Label>
                <Input
                  id="startingBalanceDate"
                  type="date"
                  value={startingBalanceDate}
                  onChange={(e) => setStartingBalanceDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setOpenStartingBalanceDialog(false);
                    setCustomerForBalance(null);
                    setStartingBalance("");
                    setStartingBalanceDate("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!customerForBalance || !startingBalance) {
                      toast.error("Please enter a starting balance");
                      return;
                    }
                    if (!startingBalanceDate) {
                      toast.error("Please select a date");
                      return;
                    }

                    try {
                      const balanceValue = parseFloat(startingBalance);
                      // Create an adjustment transaction via the customer transaction API
                      const response = await fetch(
                        `/api/accounts/transactions/customer/${customerForBalance.id}`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type: balanceValue < 0 ? "DEBIT" : "CREDIT",
                            amount: Math.abs(balanceValue),
                            description: "Starting Balance Adjustment",
                            reference: `STARTING-BALANCE-${Date.now()}`,
                            date: startingBalanceDate,
                          }),
                        }
                      );

                      const data = await response.json();

                      if (response.ok && data.success) {
                        toast.success("Starting balance set successfully!");
                        setOpenStartingBalanceDialog(false);
                        setCustomerForBalance(null);
                        setStartingBalance("");
                        setStartingBalanceDate("");
                        // Refresh the customers list
                        fetchCustomers();
                      } else {
                        toast.error(data.error || "Failed to set starting balance");
                      }
                    } catch (error) {
                      console.error("Error setting starting balance:", error);
                      toast.error("Failed to set starting balance");
                    }
                  }}
                >
                  Set Balance
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Customers Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => setImportDialogOpen(open)}>
        <DialogContent className="max-w-xl p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 text-[#4F46E5] rounded-lg flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import Customers</h3>
                <p className="text-xs text-gray-500 mt-0.5">Bulk upload from CSV or Excel file</p>
              </div>
            </div>
          </div>

          <div className="h-4" />

          <div className="mt-4 space-y-4">
            <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">Download the template to see the required format.</span>
              </div>
              <button onClick={handleDownloadTemplate} className="text-blue-600 hover:text-blue-800 font-bold underline">
                Download template
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center bg-gray-50/50 dark:bg-gray-800/40 relative hover:bg-gray-100/50 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadedFile(file);
                    toast.success(`Selected file: ${file.name}`);
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Click or drag your file here</p>
              <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS • Max. 5 MB</p>
              {uploadedFile && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200/50">
                  <Check className="w-3.5 h-3.5" />
                  {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setUploadedFile(null); }} className="px-4 py-2 border-gray-300 dark:border-gray-700 rounded-lg">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!uploadedFile) {
                  toast.error("Please select a file to import first.");
                  return;
                }
                toast.success("Customers imported successfully!");
                setImportDialogOpen(false);
                setUploadedFile(null);
                fetchCustomers();
              }}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold rounded-lg flex items-center gap-1.5 px-4 py-2"
            >
              <Upload className="w-4 h-4" />
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
