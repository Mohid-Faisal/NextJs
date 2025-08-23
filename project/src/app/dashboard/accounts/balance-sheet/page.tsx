"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Calendar, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ChartOfAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
};

type AccountBalance = {
  accountId: number;
  accountCode: string;
  accountName: string;
  category: string;
  type: string;
  balance: number;
  debitAmount: number;
  creditAmount: number;
};

type BalanceSheetData = {
  assets: {
    current: AccountBalance[];
    fixed: AccountBalance[];
    total: number;
  };
  liabilities: {
    current: AccountBalance[];
    nonCurrent: AccountBalance[];
    total: number;
  };
  equity: AccountBalance[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
};

export default function BalanceSheetPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData>({
    assets: { current: [], fixed: [], total: 0 },
    liabilities: { current: [], nonCurrent: [], total: 0 },
    equity: [],
    totalEquity: 0,
    totalLiabilitiesAndEquity: 0
  });
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      fetchAccountBalances();
    }
  }, [accounts, asOfDate]);

  useEffect(() => {
    if (accountBalances.length > 0) {
      calculateBalanceSheet();
    }
  }, [accountBalances]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chart-of-accounts?limit=1000");
      const data = await response.json();
      
      if (data.success && data.data) {
        setAccounts(data.data);
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

  const fetchAccountBalances = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/account-books?limit=all&dateTo=${asOfDate}`);
      const data = await response.json();
      
      if (data.success && data.payments) {
        const balances = calculateAccountBalances(data.payments);
        setAccountBalances(balances);
        console.log("Calculated account balances:", balances.length);
      } else {
        console.error("Failed to load account balances:", data);
        toast.error("Failed to load account balances");
      }
    } catch (error) {
      console.error("Error fetching account balances:", error);
      toast.error("Error loading account balances");
    } finally {
      setLoading(false);
    }
  };

  const calculateAccountBalances = (entries: any[]): AccountBalance[] => {
    const balanceMap = new Map<number, AccountBalance>();
    
    // Initialize all accounts with zero balances
    accounts.forEach(account => {
      balanceMap.set(account.id, {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.accountName,
        category: account.category,
        type: account.type,
        balance: 0,
        debitAmount: 0,
        creditAmount: 0
      });
    });

    // Calculate balances from journal entries
    entries.forEach(entry => {
      if (!entry.accountId) return;
      
      const account = accounts.find(acc => acc.id === entry.accountId);
      if (!account) return;

      const currentBalance = balanceMap.get(entry.accountId);
      if (!currentBalance) return;

      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;

      // Apply accounting rules based on account category
      let newBalance = currentBalance.balance;
      switch (account.category) {
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

      balanceMap.set(entry.accountId, {
        ...currentBalance,
        balance: newBalance,
        debitAmount: currentBalance.debitAmount + debitAmount,
        creditAmount: currentBalance.creditAmount + creditAmount
      });
    });

    return Array.from(balanceMap.values());
  };

  const calculateBalanceSheet = () => {
    const assets = accountBalances.filter(acc => acc.category === 'Asset');
    const liabilities = accountBalances.filter(acc => acc.category === 'Liability');
    const equity = accountBalances.filter(acc => acc.category === 'Equity');

    // Categorize assets
    const currentAssets = assets.filter(acc => 
      acc.accountName.toLowerCase().includes('cash') ||
      acc.accountName.toLowerCase().includes('receivable') ||
      acc.accountName.toLowerCase().includes('inventory') ||
      acc.accountName.toLowerCase().includes('prepaid') ||
      acc.accountName.toLowerCase().includes('bank') ||
      acc.type === 'Current'
    );

    const fixedAssets = assets.filter(acc => 
      acc.accountName.toLowerCase().includes('vehicle') ||
      acc.accountName.toLowerCase().includes('warehouse') ||
      acc.accountName.toLowerCase().includes('equipment') ||
      acc.accountName.toLowerCase().includes('building') ||
      acc.accountName.toLowerCase().includes('fleet') ||
      acc.type === 'Fixed'
    );

    // Categorize liabilities
    const currentLiabilities = liabilities.filter(acc => 
      acc.accountName.toLowerCase().includes('payable') ||
      acc.accountName.toLowerCase().includes('tax') ||
      acc.accountName.toLowerCase().includes('wage') ||
      acc.accountName.toLowerCase().includes('short') ||
      acc.type === 'Current'
    );

    const nonCurrentLiabilities = liabilities.filter(acc => 
      acc.accountName.toLowerCase().includes('loan') ||
      acc.accountName.toLowerCase().includes('mortgage') ||
      acc.accountName.toLowerCase().includes('long') ||
      acc.type === 'Non-Current'
    );

    // Calculate totals
    const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
    const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);

    setBalanceSheetData({
      assets: {
        current: currentAssets,
        fixed: fixedAssets,
        total: totalAssets
      },
      liabilities: {
        current: currentLiabilities,
        nonCurrent: nonCurrentLiabilities,
        total: totalLiabilities
      },
      equity: equity,
      totalEquity: totalEquity,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity
    });
  };

  const exportToCSV = () => {
    const headers = ["Category", "Account Code", "Account Name", "Balance"];
    const csvContent = [
      headers.join(","),
      // Assets
      ...balanceSheetData.assets.current.map(acc => [
        "Current Assets",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ...balanceSheetData.assets.fixed.map(acc => [
        "Fixed Assets",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ["", "", "Total Assets", balanceSheetData.assets.total.toLocaleString()].join(","),
      ["", "", "", ""].join(","),
      // Liabilities
      ...balanceSheetData.liabilities.current.map(acc => [
        "Current Liabilities",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ...balanceSheetData.liabilities.nonCurrent.map(acc => [
        "Non-Current Liabilities",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ["", "", "Total Liabilities", balanceSheetData.liabilities.total.toLocaleString()].join(","),
      ["", "", "", ""].join(","),
      // Equity
      ...balanceSheetData.equity.map(acc => [
        "Equity",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ["", "", "Total Equity", balanceSheetData.totalEquity.toLocaleString()].join(","),
      ["", "", "Total Liabilities & Equity", balanceSheetData.totalLiabilitiesAndEquity.toLocaleString()].join(",")
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balance-sheet-${asOfDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Balance sheet exported successfully");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderAccountRow = (account: AccountBalance, indent: boolean = false) => (
    <div key={account.accountId} className={`flex justify-between items-center py-1 ${indent ? 'ml-6' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">{account.accountCode}</span>
        <span className="text-sm font-medium">{account.accountName}</span>
      </div>
      <span className={`text-sm font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(account.balance)}
      </span>
    </div>
  );

  const renderSection = (title: string, accounts: AccountBalance[], total: number, color: string) => (
    <div className="space-y-2">
      <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
      {accounts.length > 0 ? (
        <>
          {accounts.map(account => renderAccountRow(account, true))}
          <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-bold">Total {title}</span>
            <span className={`font-bold text-lg ${color}`}>{formatCurrency(total)}</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500 italic ml-6">No accounts found</div>
      )}
    </div>
  );

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
        
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
              Balance Sheet
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Company's financial position as of a specific date
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <Label htmlFor="asOfDate" className="text-sm font-medium">As of:</Label>
              <Input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="w-full sm:w-40"
              />
            </div>
            <Button
              onClick={exportToCSV}
              variant="outline"
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading balance sheet...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-8">
          {/* Assets */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800 dark:text-green-200 flex items-center">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
              {renderSection("Current Assets", balanceSheetData.assets.current, 
                balanceSheetData.assets.current.reduce((sum, acc) => sum + acc.balance, 0), 
                "text-green-600")}
              
              {renderSection("Fixed Assets", balanceSheetData.assets.fixed, 
                balanceSheetData.assets.fixed.reduce((sum, acc) => sum + acc.balance, 0), 
                "text-green-600")}
              
              <div className="flex justify-between items-center py-4 border-t-2 border-green-200 dark:border-green-800">
                <span className="text-xl font-bold text-green-800 dark:text-green-200">Total Assets</span>
                <span className="text-xl font-bold text-green-800 dark:text-green-200">
                  {formatCurrency(balanceSheetData.assets.total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Liabilities & Equity */}
          <div className="space-y-4 sm:space-y-8">
            {/* Liabilities */}
            <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
              <CardHeader className="bg-red-50 dark:bg-red-900/20">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-red-800 dark:text-red-200">
                  Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
                {renderSection("Current Liabilities", balanceSheetData.liabilities.current, 
                  balanceSheetData.liabilities.current.reduce((sum, acc) => sum + acc.balance, 0), 
                  "text-red-600")}
                
                {renderSection("Non-Current Liabilities", balanceSheetData.liabilities.nonCurrent, 
                  balanceSheetData.liabilities.nonCurrent.reduce((sum, acc) => sum + acc.balance, 0), 
                  "text-red-600")}
                
                <div className="flex justify-between items-center py-4 border-t-2 border-red-200 dark:border-red-800">
                  <span className="text-xl font-bold text-red-800 dark:text-red-200">Total Liabilities</span>
                  <span className="text-xl font-bold text-red-800 dark:text-red-200">
                    {formatCurrency(balanceSheetData.liabilities.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Equity */}
            <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-800 dark:text-blue-200">
                  Equity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
                {balanceSheetData.equity.length > 0 ? (
                  <>
                    {balanceSheetData.equity.map(account => renderAccountRow(account, true))}
                    <div className="flex justify-between items-center py-4 border-t-2 border-blue-200 dark:border-blue-800">
                      <span className="text-xl font-bold text-blue-800 dark:text-blue-200">Total Equity</span>
                      <span className="text-xl font-bold text-blue-800 dark:text-blue-200">
                        {formatCurrency(balanceSheetData.totalEquity)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 italic ml-6">No equity accounts found</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <Card className="mt-4 sm:mt-8 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Assets</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                  {formatCurrency(balanceSheetData.assets.total)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Liabilities</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">
                  {formatCurrency(balanceSheetData.liabilities.total)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Equity</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                  {formatCurrency(balanceSheetData.totalEquity)}
                </div>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                <span className="text-base sm:text-lg font-bold">Total Liabilities & Equity</span>
                <span className="text-base sm:text-lg font-bold">
                  {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>
              
              {Math.abs(balanceSheetData.assets.total - balanceSheetData.totalLiabilitiesAndEquity) > 0.01 && (
                <div className="mt-2 text-xs sm:text-sm text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                  ⚠️ Balance sheet is not balanced. Difference: {formatCurrency(
                    balanceSheetData.assets.total - balanceSheetData.totalLiabilitiesAndEquity
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
