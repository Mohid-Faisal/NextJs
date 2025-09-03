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
  Users, 
  Building2, 
  Search, 
  Calendar, 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  BookOpen
} from "lucide-react";
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

type Vendor = {
  id: number;
  CompanyName: string;
  PersonName: string;
  currentBalance: number;
};

type ShipmentInfo = {
  awbNo: string;
  weight: number;
  destination: string;
  referenceNo: string;
  status: string;
  shipmentDate: string;
};

type CustomerTransaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference?: string;
  invoice?: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
  shipmentInfo?: ShipmentInfo | null;
};

type VendorTransaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference?: string;
  invoice?: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
  shipmentInfo?: ShipmentInfo | null;
};

export default function LedgerPage() {
  const [activeTab, setActiveTab] = useState<'customers' | 'vendors'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransaction[]>([]);
  const [vendorTransactions, setVendorTransactions] = useState<VendorTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);

  // Sorting states
  type SortField = "createdAt" | "amount" | "type" | "description" | "reference";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const totalPages = Math.ceil(total / limit);

  useEffect(() => {
    fetchCustomers();
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerTransactions();
    }
  }, [selectedCustomer, page, searchTerm, sortField, sortOrder, limit]);

  useEffect(() => {
    if (selectedVendor) {
      fetchVendorTransactions();
    }
  }, [selectedVendor, page, searchTerm, sortField, sortOrder, limit]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch("/api/customers");
      const data = await response.json();
      if (response.ok) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendors");
      const data = await response.json();
      if (response.ok) {
        setVendors(data.vendors || []);
      }
    } catch (error) {
      console.error("Error fetching vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerTransactions = async () => {
    if (!selectedCustomer) return;
    
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm && { search: searchTerm }),
        sortField,
        sortOrder,
      });

      const response = await fetch(`/api/accounts/transactions/customer/${selectedCustomer.id}?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setCustomerTransactions(data.transactions || []);
        setTotal(data.total || data.transactions.length);
      }
    } catch (error) {
      console.error("Error fetching customer transactions:", error);
    }
  };

  const fetchVendorTransactions = async () => {
    if (!selectedVendor) return;
    
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm && { search: searchTerm }),
        sortField,
        sortOrder,
      });

      const response = await fetch(`/api/accounts/transactions/vendor/${selectedVendor.id}?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setVendorTransactions(data.transactions || []);
        setTotal(data.total || data.transactions.length);
      }
    } catch (error) {
      console.error("Error fetching vendor transactions:", error);
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

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.PersonName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.CompanyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.PersonName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentTransactions = activeTab === 'customers' ? customerTransactions : vendorTransactions;
  const selectedEntity = activeTab === 'customers' ? selectedCustomer : selectedVendor;

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-3">
          <BookOpen className="w-10 h-10 text-blue-600" />
          Ledger
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View customer and vendor transaction ledgers
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
          <button
            onClick={() => {
              setActiveTab('customers');
              setSelectedCustomer(null);
              setSelectedVendor(null);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'customers'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Customer Ledger
          </button>
          <button
            onClick={() => {
              setActiveTab('vendors');
              setSelectedCustomer(null);
              setSelectedVendor(null);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'vendors'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Vendor Ledger
          </button>
        </div>
      </div>

      {/* Entity Selection - Top Section */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Select {activeTab === 'customers' ? 'Customer' : 'Vendor'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-48 overflow-y-auto">
            {activeTab === 'customers' ? (
              filteredCustomers.length === 0 ? (
                <p className="text-gray-500 text-center py-8 col-span-full">
                  No customers found
                </p>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedCustomer?.id === customer.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setSelectedVendor(null);
                      setPage(1);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {customer.CompanyName}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {customer.PersonName}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          customer.currentBalance > 0
                            ? "text-red-600 dark:text-red-400"
                            : customer.currentBalance < 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}>
                          PKR {customer.currentBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              filteredVendors.length === 0 ? (
                <p className="text-gray-500 text-center py-8 col-span-full">
                  No vendors found
                </p>
              ) : (
                filteredVendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-all ${
                      selectedVendor?.id === vendor.id
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600"
                    }`}
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setSelectedCustomer(null);
                      setPage(1);
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {vendor.CompanyName}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {vendor.PersonName}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          vendor.currentBalance > 0
                            ? "text-red-600 dark:text-red-400"
                            : vendor.currentBalance < 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}>
                          PKR {vendor.currentBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Details - Full Width */}
      <div className="w-full">
        {selectedEntity ? (
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
                    {selectedEntity.CompanyName}
                  </CardTitle>
                  <p className="text-gray-600 dark:text-gray-400">
                    {selectedEntity.PersonName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Current Balance
                  </div>
                  <div className="text-2xl font-bold">
                    <span
                      className={
                        selectedEntity.currentBalance > 0
                          ? "text-red-600 dark:text-red-400"
                          : selectedEntity.currentBalance < 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-gray-600 dark:text-gray-400"
                      }
                    >
                      PKR {selectedEntity.currentBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="mb-6 flex justify-between items-end gap-4">
                <div className="flex w-full max-w-sm">
                  <Input
                    placeholder="Search transactions..."
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

                <div className="flex gap-4 items-end">
                  <Select
                    value={String(limit)}
                    onValueChange={(value) => {
                      setLimit(parseInt(value));
                      setPage(1);
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
              </div>

              {/* Transactions Table */}
              {currentTransactions.length === 0 ? (
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
                        <th className="px-4 py-2 text-left">Ship.Date</th>
                        <th className="px-4 py-2 text-left">AwbNo</th>
                        <th className="px-4 py-2 text-left">Weight</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Destination</th>
                        <th className="px-4 py-2 text-left">Reference No</th>
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
                            onClick={() => handleSort("amount")}
                            className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            DR. {getSortIcon("amount")}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left">
                          <button
                            onClick={() => handleSort("amount")}
                            className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            CR. {getSortIcon("amount")}
                          </button>
                        </th>
                        <th className="px-4 py-2 text-left">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm text-gray-700 dark:text-gray-200">
                      {currentTransactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3">
                            {format(parseISO(transaction.createdAt), "dd-MM-yyyy")}
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.shipmentDate 
                              ? format(parseISO(transaction.shipmentInfo.shipmentDate), "yyyy-MM-dd")
                              : "-"
                            }
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.awbNo || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.weight 
                              ? transaction.shipmentInfo.weight.toFixed(2)
                              : "-"
                            }
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.status || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.destination || "-"}
                          </td>
                          <td className="px-4 py-3">
                            {transaction.shipmentInfo?.referenceNo || transaction.reference || "-"}
                          </td>
                          <td className="px-4 py-3">{transaction.description}</td>
                          <td className="px-4 py-3 font-medium">
                            {transaction.type === "DEBIT" ? (
                              <span className="text-red-600 dark:text-red-400">
                                {transaction.amount.toLocaleString()}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {transaction.type === "CREDIT" ? (
                              <span className="text-green-600 dark:text-green-400">
                                {transaction.amount.toLocaleString()}
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
                              {transaction.newBalance.toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

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
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <CardContent className="p-6">
              <div className="text-center py-10">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Select a {activeTab === 'customers' ? 'Customer' : 'Vendor'}
                </h3>
                <p className="text-gray-500 dark:text-gray-500">
                  Choose a {activeTab === 'customers' ? 'customer' : 'vendor'} from the list to view their transaction ledger
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}