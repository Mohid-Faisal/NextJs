"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Filter, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ChartOfAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
};

type Payment = {
  id: number;
  date: string;
  description: string;
  amount: number;
  reference: string;
  transactionType: string;
  category: string;
  mode: string;
  fromCustomer: string;
  toVendor: string;
  fromPartyType: string;
  toPartyType: string;
  fromCustomerId?: number;
  toVendorId?: number;
  invoice?: string;
};

export default function AccountBooksPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all-categories");
  const [entries, setEntries] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedCategory && selectedCategory !== "all-categories") {
      fetchEntries();
    } else if (selectedCategory === "all-categories") {
      // Load all payments when "All Categories" is selected
      fetchEntries();
    }
  }, [selectedCategory, dateFrom, dateTo]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chart-of-accounts?limit=1000");
      const data = await response.json();
      
      if (data.success && data.data) {
        setAccounts(data.data);
        // Extract unique categories
        const uniqueCategories = [...new Set(data.data.map((acc: ChartOfAccount) => acc.category))] as string[];
        setCategories(uniqueCategories.sort());
        console.log("Loaded accounts:", data.data.length);
      } else {
        console.error("Failed to load accounts:", data);
        toast.error("Failed to load chart of accounts");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Error loading chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchEntries = async () => {
    try {
      setLoading(true);
      let url = "/api/account-books?limit=all";
      
      if (selectedCategory && selectedCategory !== "all-categories") {
        url += `&category=${selectedCategory}`;
      }
      if (dateFrom) {
        url += `&dateFrom=${dateFrom}`;
      }
      if (dateTo) {
        url += `&dateTo=${dateTo}`;
      }

      console.log("Fetching from URL:", url);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error("HTTP Error:", response.status, response.statusText);
        const errorText = await response.text();
        console.error("Error response:", errorText);
        toast.error(`HTTP Error: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      console.log("API Response:", data);
      
      if (data.success) {
        setEntries(data.payments || []);
        console.log("Loaded payments:", data.payments?.length || 0);
        if (data.payments?.length === 0) {
          toast.info("No payments found for the selected filters");
        }
      } else {
        console.error("Failed to load entries:", data);
        toast.error(data.error || "Failed to load payment entries");
      }
    } catch (error) {
      console.error("Error fetching entries:", error);
      toast.error("Error loading payment entries");
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => 
    entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.fromCustomer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.toVendor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountBalance = () => {
    if (!selectedAccount) return 0;
    
    let balance = 0;
    entries.forEach(entry => {
      // Since Payment model doesn't have account relationships, 
      // we can't calculate balance by account
      balance += entry.amount;
    });
    return balance;
  };

  const exportToCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ["Date", "Description", "From", "To", "Amount", "Reference", "Type", "Category", "Mode"];
    const csvContent = [
      headers.join(","),
      ...filteredEntries.map(entry => [
        new Date(entry.date).toLocaleDateString(),
        `"${entry.description || ''}"`,
        entry.fromCustomer,
        entry.toVendor,
        entry.amount,
        entry.reference || '',
        entry.transactionType,
        entry.category,
        entry.mode
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `account-book-${selectedAccount || selectedCategory}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Account book exported successfully");
  };

  const clearFilters = () => {
    setSelectedAccount(0);
    setSelectedCategory("all-categories");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setEntries([]);
  };

  const testPayments = async () => {
    try {
      const response = await fetch("/api/test-payments");
      const data = await response.json();
      console.log("Test payments response:", data);
      toast.info(`Found ${data.totalCount} payments in database`);
      
      if (data.samplePayments && data.samplePayments.length > 0) {
        console.log("Sample payment structure:", data.samplePayments[0]);
      }
    } catch (error) {
      console.error("Error testing payments:", error);
      toast.error("Error testing payments");
    }
  };

  const loadAllPayments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/account-books?limit=all");
      const data = await response.json();
      
      if (data.success) {
        setEntries(data.payments || []);
        setSelectedCategory("all-categories");
        toast.success(`Loaded ${data.payments?.length || 0} payments`);
      } else {
        toast.error(data.error || "Failed to load payments");
      }
    } catch (error) {
      console.error("Error loading all payments:", error);
      toast.error("Error loading payments");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Account Books
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View journal entries by account or category
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters */}
        <Card className="lg:col-span-1 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="account" className="font-bold">
                Account
              </Label>
              <Select value={String(selectedAccount)} onValueChange={(value) => setSelectedAccount(parseInt(value))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">All Accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {account.code} - {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category" className="font-bold">
                Category
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-categories">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dateFrom" className="font-bold">
                Date From
              </Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="dateTo" className="font-bold">
                Date To
              </Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1"
              />
            </div>

            <Button
              onClick={clearFilters}
              variant="outline"
              className="w-full"
            >
              Clear Filters
            </Button>
            
            <Button
              onClick={testPayments}
              variant="outline"
              className="w-full"
            >
              Test Payments
            </Button>
            
            <Button
              onClick={loadAllPayments}
              variant="outline"
              className="w-full"
            >
              Load All Payments
            </Button>
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card className="lg:col-span-3 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
                Journal Entries
              </CardTitle>
              <div className="flex gap-2">
                {selectedAccount > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Balance: <span className={`font-bold ${getAccountBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${getAccountBalance().toLocaleString()}
                    </span>
                  </div>
                )}
                <Button
                  onClick={exportToCSV}
                  variant="outline"
                  size="sm"
                  disabled={filteredEntries.length === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Loading entries...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                {selectedCategory && selectedCategory !== "all-categories" ? 
                  "No payment entries found for the selected category" : 
                  "No payment entries found. Please create some payments first or select a different category."
                }
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800 dark:text-white">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                            {entry.transactionType}
                          </span>
                          {entry.category && (
                            <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded">
                              {entry.category}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {entry.description}
                        </p>
                                                                         <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-red-600 dark:text-red-400 font-medium">From:</span> {entry.fromCustomer}
                          </div>
                          <div>
                            <span className="text-green-600 dark:text-green-400 font-medium">To:</span> {entry.toVendor}
                          </div>
                        </div>
                        {entry.reference && (
                          <p className="text-xs text-gray-500 mt-1">
                            Ref: {entry.reference}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-gray-800 dark:text-white">
                          ${entry.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400">
                  <span>Total Entries: {filteredEntries.length}</span>
                  <span>
                    Total Amount: ${filteredEntries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
