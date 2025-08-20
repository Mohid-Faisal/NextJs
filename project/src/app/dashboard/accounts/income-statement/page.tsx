"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
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

type IncomeStatementData = {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  period: {
    startDate: string;
    endDate: string;
  };
};

export default function IncomeStatementPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([]);
  const [incomeStatementData, setIncomeStatementData] = useState<IncomeStatementData>({
    revenues: [],
    expenses: [],
    totalRevenue: 0,
    totalExpenses: 0,
    netIncome: 0,
    period: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), // Start of current year
      endDate: new Date().toISOString().slice(0, 10) // Today
    }
  });
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState<'year' | 'quarter' | 'month' | 'custom'>('year');

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      updatePeriodDates();
    }
  }, [accounts, periodType]);

  useEffect(() => {
    if (incomeStatementData.period.startDate && incomeStatementData.period.endDate) {
      fetchAccountBalances();
    }
  }, [incomeStatementData.period]);

  useEffect(() => {
    if (accountBalances.length > 0) {
      calculateIncomeStatement();
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

  const updatePeriodDates = () => {
    const now = new Date();
    let startDate: string;
    let endDate: string = now.toISOString().slice(0, 10);

    switch (periodType) {
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
        break;
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3, 1).toISOString().slice(0, 10);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        break;
      case 'custom':
        // Keep existing dates for custom period
        return;
      default:
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    }

    setIncomeStatementData(prev => ({
      ...prev,
      period: { startDate, endDate }
    }));
  };

  const fetchAccountBalances = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = incomeStatementData.period;
      const response = await fetch(`/api/account-books?limit=all&dateFrom=${startDate}&dateTo=${endDate}`);
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
    
    // Initialize revenue and expense accounts with zero balances
    accounts.forEach(account => {
      if (account.category === 'Revenue' || account.category === 'Expense') {
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
      }
    });

    // Calculate balances from journal entries
    entries.forEach(entry => {
      if (!entry.accountId) return;
      
      const account = accounts.find(acc => acc.id === entry.accountId);
      if (!account || (account.category !== 'Revenue' && account.category !== 'Expense')) return;

      const currentBalance = balanceMap.get(entry.accountId);
      if (!currentBalance) return;

      const debitAmount = entry.debitAmount || 0;
      const creditAmount = entry.creditAmount || 0;

      // Apply accounting rules for income statement
      let newBalance = currentBalance.balance;
      if (account.category === 'Revenue') {
        // Revenue: Credit increases, Debit decreases
        newBalance += creditAmount - debitAmount;
      } else if (account.category === 'Expense') {
        // Expense: Debit increases, Credit decreases
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

  const calculateIncomeStatement = () => {
    const revenues = accountBalances.filter(acc => acc.category === 'Revenue');
    const expenses = accountBalances.filter(acc => acc.category === 'Expense');

    const totalRevenue = revenues.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0);
    const netIncome = totalRevenue - totalExpenses;

    setIncomeStatementData(prev => ({
      ...prev,
      revenues,
      expenses,
      totalRevenue,
      totalExpenses,
      netIncome
    }));
  };

  const exportToCSV = () => {
    const headers = ["Category", "Account Code", "Account Name", "Amount"];
    const csvContent = [
      headers.join(","),
      // Revenues
      ...incomeStatementData.revenues.map(acc => [
        "Revenue",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ["", "", "Total Revenues", incomeStatementData.totalRevenue.toLocaleString()].join(","),
      ["", "", "", ""].join(","),
      // Expenses
      ...incomeStatementData.expenses.map(acc => [
        "Expense",
        acc.accountCode,
        `"${acc.accountName}"`,
        acc.balance.toLocaleString()
      ].join(",")),
      ["", "", "Total Expenses", incomeStatementData.totalExpenses.toLocaleString()].join(","),
      ["", "", "", ""].join(","),
      // Net Income
      ["", "", "Net Income", incomeStatementData.netIncome.toLocaleString()].join(",")
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income-statement-${incomeStatementData.period.startDate}-to-${incomeStatementData.period.endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast.success("Income statement exported successfully");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPeriod = () => {
    const startDate = new Date(incomeStatementData.period.startDate);
    const endDate = new Date(incomeStatementData.period.endDate);
    
    if (periodType === 'year') {
      return `for year ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'quarter') {
      return `for quarter ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'month') {
      return `for month ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else {
      return `for period ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  };

  const renderAccountRow = (account: AccountBalance) => (
    <div key={account.accountId} className="flex justify-between items-center py-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-400 w-16">{account.accountCode}</span>
        <span className="text-sm font-medium">{account.accountName}</span>
      </div>
      <span className={`text-sm font-bold ${account.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(account.balance)}
      </span>
    </div>
  );

  const renderSection = (title: string, accounts: AccountBalance[], total: number, color: string, icon: React.ReactNode) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className={`text-xl font-bold ${color}`}>{title}</h3>
      </div>
      {accounts.length > 0 ? (
        <>
          <div className="space-y-1">
            {accounts.map(account => renderAccountRow(account))}
          </div>
          <div className="flex justify-between items-center py-3 border-t-2 border-gray-200 dark:border-gray-700">
            <span className="text-lg font-bold">Total {title}</span>
            <span className={`text-lg font-bold ${color}`}>{formatCurrency(total)}</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-500 italic py-4">No {title.toLowerCase()} found for this period</div>
      )}
    </div>
  );

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
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
              Income Statement
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {formatPeriod()}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="periodType" className="text-sm font-medium">Period:</Label>
              <select
                id="periodType"
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value="year">Current Year</option>
                <option value="quarter">Current Quarter</option>
                <option value="month">Current Month</option>
                <option value="custom">Custom Period</option>
              </select>
            </div>
            
            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <Input
                  type="date"
                  value={incomeStatementData.period.startDate}
                  onChange={(e) => setIncomeStatementData(prev => ({
                    ...prev,
                    period: { ...prev.period, startDate: e.target.value }
                  }))}
                  className="w-32"
                />
                <span className="text-gray-500">to</span>
                <Input
                  type="date"
                  value={incomeStatementData.period.endDate}
                  onChange={(e) => setIncomeStatementData(prev => ({
                    ...prev,
                    period: { ...prev.period, endDate: e.target.value }
                  }))}
                  className="w-32"
                />
              </div>
            )}
            
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading income statement...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Revenues */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="text-2xl font-bold text-green-800 dark:text-green-200 flex items-center">
                <TrendingUp className="w-6 h-6 mr-2" />
                Revenues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {renderSection("Revenues", incomeStatementData.revenues, incomeStatementData.totalRevenue, 
                "text-green-600", <TrendingUp className="w-5 h-5 text-green-600" />)}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-red-50 dark:bg-red-900/20">
              <CardTitle className="text-2xl font-bold text-red-800 dark:text-red-200 flex items-center">
                <TrendingDown className="w-6 h-6 mr-2" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {renderSection("Expenses", incomeStatementData.expenses, incomeStatementData.totalExpenses, 
                "text-red-600", <TrendingDown className="w-5 h-5 text-red-600" />)}
            </CardContent>
          </Card>

          {/* Net Income */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className={`${incomeStatementData.netIncome >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
              <CardTitle className={`text-2xl font-bold flex items-center ${incomeStatementData.netIncome >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'}`}>
                <DollarSign className="w-6 h-6 mr-2" />
                Net Income (Current Year Earnings)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-center py-4">
                <span className="text-xl font-bold">Net Income</span>
                <span className={`text-2xl font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatementData.netIncome)}
                </span>
              </div>
              
              {incomeStatementData.netIncome >= 0 ? (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  ✅ Profitable period with positive net income
                </div>
              ) : (
                <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  ⚠️ Net loss for this period
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <Card className="mt-8 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(incomeStatementData.totalRevenue)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(incomeStatementData.totalExpenses)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600 dark:text-gray-400">Net Income</div>
                <div className={`text-2xl font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatementData.netIncome)}
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Profit Margin</div>
                  <div className="text-lg font-bold">
                    {incomeStatementData.totalRevenue > 0 
                      ? `${((incomeStatementData.netIncome / incomeStatementData.totalRevenue) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expense Ratio</div>
                  <div className="text-lg font-bold">
                    {incomeStatementData.totalRevenue > 0 
                      ? `${((incomeStatementData.totalExpenses / incomeStatementData.totalRevenue) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
