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
  id: string;
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
  // New fields for journal entries
  accountName?: string;
  accountCode?: string;
  accountId?: number;
  journalEntryNumber?: string;
  debitAmount?: number;
  creditAmount?: number;
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
    fetchEntries();
  }, [selectedAccount, selectedCategory, dateFrom, dateTo]);

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
      
      if (selectedAccount && selectedAccount > 0) {
        url += `&accountId=${selectedAccount}`;
      }
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
    entry.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.accountCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.journalEntryNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAccountBalance = () => {
    if (!selectedAccount) return 0;
    
    // Find the selected account to determine its category
    const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);
    if (!selectedAccountData) return 0;
    
    let balance = 0;
    entries.forEach(entry => {
      if (entry.accountId === selectedAccount) {
        const debitAmount = entry.debitAmount || 0;
        const creditAmount = entry.creditAmount || 0;
        
        // Apply accounting rules based on account category
        switch (selectedAccountData.category) {
          case 'Asset':
            // Assets: Debit increases, Credit decreases
            balance += debitAmount - creditAmount;
            break;
          case 'Liability':
            // Liabilities: Credit increases, Debit decreases
            balance += creditAmount - debitAmount;
            break;
          case 'Equity':
            // Equity: Credit increases, Debit decreases
            balance += creditAmount - debitAmount;
            break;
          case 'Revenue':
            // Revenue: Credit increases, Debit decreases
            balance += creditAmount - debitAmount;
            break;
          case 'Expense':
            // Expenses: Debit increases, Credit decreases
            balance += debitAmount - creditAmount;
            break;
          default:
            // Default: assume normal balance (debit increases)
            balance += debitAmount - creditAmount;
        }
      }
    });
    return balance;
  };

  const getTotalBalance = () => {
    if (selectedAccount > 0) {
      return getAccountBalance();
    }
    
    // Calculate total balance for all accounts or filtered accounts
    let totalBalance = 0;
    const accountBalances = new Map<number, number>();
    
    // Group entries by account
    entries.forEach(entry => {
      if (!entry.accountId) return;
      
      const accountData = accounts.find(acc => acc.id === entry.accountId);
      if (!accountData) return;
      
      if (!accountBalances.has(entry.accountId)) {
        accountBalances.set(entry.accountId, 0);
      }
      
      const currentBalance = accountBalances.get(entry.accountId)!;
      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;
      
      // Apply accounting rules based on account category
      let newBalance = currentBalance;
      switch (accountData.category) {
        case 'Asset':
          newBalance += debitAmount - creditAmount;
          break;
        case 'Liability':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Equity':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Revenue':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Expense':
          newBalance += debitAmount - creditAmount;
          break;
        default:
          newBalance += debitAmount - creditAmount;
      }
      
      accountBalances.set(entry.accountId, newBalance);
    });
    
    // Sum up all account balances
    accountBalances.forEach(balance => {
      totalBalance += balance;
    });
    
    return totalBalance;
  };

  const getBalanceBreakdown = () => {
    const breakdown = {
      assets: 0,
      liabilities: 0,
      equity: 0,
      revenue: 0,
      expenses: 0
    };
    
    const accountBalances = new Map<number, number>();
    
    // Calculate balances for each account
    entries.forEach(entry => {
      if (!entry.accountId) return;
      
      const accountData = accounts.find(acc => acc.id === entry.accountId);
      if (!accountData) return;
      
      if (!accountBalances.has(entry.accountId)) {
        accountBalances.set(entry.accountId, 0);
      }
      
      const currentBalance = accountBalances.get(entry.accountId)!;
      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;
      
      let newBalance = currentBalance;
      switch (accountData.category) {
        case 'Asset':
          newBalance += debitAmount - creditAmount;
          break;
        case 'Liability':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Equity':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Revenue':
          newBalance += creditAmount - debitAmount;
          break;
        case 'Expense':
          newBalance += debitAmount - creditAmount;
          break;
        default:
          newBalance += debitAmount - creditAmount;
      }
      
      accountBalances.set(entry.accountId, newBalance);
    });
    
    // Group by category
    accountBalances.forEach((balance, accountId) => {
      const accountData = accounts.find(acc => acc.id === accountId);
      if (accountData) {
        switch (accountData.category) {
          case 'Asset':
            breakdown.assets += balance;
            break;
          case 'Liability':
            breakdown.liabilities += balance;
            break;
          case 'Equity':
            breakdown.equity += balance;
            break;
          case 'Revenue':
            breakdown.revenue += balance;
            break;
          case 'Expense':
            breakdown.expenses += balance;
            break;
        }
      }
    });
    
    return breakdown;
  };

  const exportToCSV = () => {
    if (filteredEntries.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ["Date", "Description", "Account", "Account Code", "Type", "Amount", "Reference", "Category", "Journal Entry"];
    const csvContent = [
      headers.join(","),
      ...filteredEntries.map(entry => [
        new Date(entry.date).toLocaleDateString(),
        `"${entry.description || ''}"`,
        entry.accountName || '',
        entry.accountCode || '',
        entry.transactionType,
        entry.amount,
        entry.reference || '',
        entry.category,
        entry.journalEntryNumber || ''
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



  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="mb-4 sm:mb-6">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
          Account Books
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View journal entries and account transactions
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
        {/* Filters */}
        <Card className="xl:col-span-1 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white flex items-center">
              <Filter className="w-5 h-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">

            <div>
              <Label htmlFor="category" className="font-bold text-sm sm:text-base">
                Category
              </Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="mt-1 w-full">
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
              <Label htmlFor="account" className="font-bold text-sm sm:text-base">
                Account
              </Label>
              <Select value={String(selectedAccount)} onValueChange={(value) => setSelectedAccount(parseInt(value))}>
                <SelectTrigger className="mt-1 w-full">
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
              <Label htmlFor="dateFrom" className="font-bold text-sm sm:text-base">
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
              <Label htmlFor="dateTo" className="font-bold text-sm sm:text-base">
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
          </CardContent>
        </Card>

        {/* Entries List */}
        <Card className="xl:col-span-3 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                Journal Entries & Transactions
              </CardTitle>
              <div className="flex gap-2">
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
            
            {/* Balance Summary */}
            <div className="mt-4 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {selectedAccount > 0 ? (
                  <div className="text-center">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Account Balance</div>
                    <div className={`text-base sm:text-lg font-bold ${getAccountBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      PKR {getAccountBalance().toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {accounts.find(acc => acc.id === selectedAccount)?.accountName}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Balance</div>
                      <div className={`text-base sm:text-lg font-bold ${getTotalBalance() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        PKR {getTotalBalance().toLocaleString()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Entries</div>
                      <div className="text-base sm:text-lg font-bold text-blue-600">
                        {filteredEntries.length}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                      <div className="text-base sm:text-lg font-bold text-purple-600">
                        PKR {filteredEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0).toLocaleString()}
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Balance Breakdown for All Accounts */}
              {selectedAccount === 0 && filteredEntries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Balance Breakdown by Category</div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 text-xs">
                    {(() => {
                      const breakdown = getBalanceBreakdown();
                      return [
                        { label: 'Assets', value: breakdown.assets, color: 'text-green-600' },
                        { label: 'Liabilities', value: breakdown.liabilities, color: 'text-red-600' },
                        { label: 'Equity', value: breakdown.equity, color: 'text-blue-600' },
                        { label: 'Revenue', value: breakdown.revenue, color: 'text-purple-600' },
                        { label: 'Expenses', value: breakdown.expenses, color: 'text-orange-600' }
                      ].map(item => (
                        <div key={item.label} className="text-center">
                          <div className="text-gray-600 dark:text-gray-400">{item.label}</div>
                          <div className={`font-bold ${item.color}`}>
                            PKR {item.value.toLocaleString()}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by description, account, reference, or journal entry..."
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
                    className="p-3 sm:p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800 dark:text-white text-sm sm:text-base">
                            {new Date(entry.date).toLocaleDateString()}
                          </span>
                          <span className={`text-xs px-1 sm:px-2 py-1 rounded ${
                            entry.transactionType === 'DEBIT' 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' 
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          }`}>
                            <span className="hidden sm:inline">{entry.transactionType}</span>
                            <span className="sm:hidden">{entry.transactionType?.substring(0, 3)}</span>
                          </span>
                          {entry.category && (
                            <span className="text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 px-1 sm:px-2 py-1 rounded">
                              <span className="hidden sm:inline">{entry.category}</span>
                              <span className="sm:hidden">{entry.category?.substring(0, 4)}</span>
                            </span>
                          )}
                          {entry.accountCode && (
                            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1 sm:px-2 py-1 rounded">
                              <span className="hidden sm:inline">{entry.accountCode}</span>
                              <span className="sm:hidden">{entry.accountCode?.substring(0, 6)}...</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span className="hidden sm:inline">{entry.description}</span>
                          <span className="sm:hidden">{entry.description?.substring(0, 50)}...</span>
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs">
                          <div>
                            <span className="font-medium">Account:</span> 
                            <span className="hidden sm:inline"> {entry.accountName}</span>
                            <span className="sm:hidden"> {entry.accountName?.substring(0, 15)}...</span>
                          </div>
                          <div>
                            <span className="font-medium">Entry:</span> 
                            <span className="hidden sm:inline"> {entry.journalEntryNumber}</span>
                            <span className="sm:hidden"> {entry.journalEntryNumber?.substring(0, 8)}...</span>
                          </div>
                        </div>
                        {entry.reference && (
                          <p className="text-xs text-gray-500 mt-1">
                            <span className="hidden sm:inline">Ref: {entry.reference}</span>
                            <span className="sm:hidden">Ref: {entry.reference?.substring(0, 20)}...</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-base sm:text-lg text-gray-800 dark:text-white">
                          PKR {entry.amount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <span>Total Entries: {filteredEntries.length}</span>
                  <span>
                    Total Amount: PKR {filteredEntries.reduce((sum, entry) => sum + entry.amount, 0).toLocaleString()}
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
