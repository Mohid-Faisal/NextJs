"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download, Calendar, TrendingUp, TrendingDown, DollarSign, ArrowUp, Table, Printer, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, eachYearOfInterval, startOfYear, endOfYear, addMonths, subMonths, differenceInYears } from "date-fns";

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

type PeriodData = {
  periodLabel: string;
  startDate: string;
  endDate: string;
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
};

type IncomeStatementData = {
  revenues: AccountBalance[];
  expenses: AccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
  period: {
    startDate: string;
    endDate: string;
  };
  periods?: PeriodData[]; // For multi-column view
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
    grossProfit: 0,
    netIncome: 0,
    period: {
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10), // Start of current year
      endDate: new Date().toISOString().slice(0, 10) // Today
    }
  });
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState<'year' | 'month' | 'last3month' | 'last6month' | 'financialyear' | 'custom'>('month');
  const [periodsData, setPeriodsData] = useState<PeriodData[]>([]);

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
      if (shouldShowMultiColumn()) {
        fetchMultiPeriodBalances();
      } else {
        fetchAccountBalances();
      }
    }
  }, [incomeStatementData.period, periodType]);

  const shouldShowMultiColumn = () => {
    if (['last3month', 'last6month', 'year', 'financialyear'].includes(periodType)) {
      return true;
    }
    
    // For custom periods, check if it spans more than one year
    if (periodType === 'custom') {
      const startDate = new Date(incomeStatementData.period.startDate);
      const endDate = new Date(incomeStatementData.period.endDate);
      const yearsDiff = differenceInYears(endDate, startDate);
      return yearsDiff >= 1; // Show multi-column if spans 1 or more years
    }
    
    return false;
  };

  const generateSubPeriods = (): { label: string; startDate: Date; endDate: Date }[] => {
    const now = new Date();
    let endDate = now;
    let startDate: Date;
    let periods: { label: string; startDate: Date; endDate: Date }[] = [];

    switch (periodType) {
      case 'last3month':
        startDate = startOfMonth(subMonths(now, 2)); // 3 months ago
        const months3 = eachMonthOfInterval({ start: startDate, end: endDate });
        periods = months3.map(month => ({
          label: format(month, 'MMM yyyy'),
          startDate: startOfMonth(month),
          endDate: month.getTime() === endOfMonth(now).getTime() ? endDate : endOfMonth(month)
        }));
        break;
      case 'last6month':
        startDate = startOfMonth(subMonths(now, 5)); // 6 months ago
        const months6 = eachMonthOfInterval({ start: startDate, end: endDate });
        periods = months6.map(month => ({
          label: format(month, 'MMM yyyy'),
          startDate: startOfMonth(month),
          endDate: month.getTime() === endOfMonth(now).getTime() ? endDate : endOfMonth(month)
        }));
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1); // January 1
        const monthsYear = eachMonthOfInterval({ start: startDate, end: endDate });
        periods = monthsYear.map(month => ({
          label: format(month, 'MMM yyyy'),
          startDate: startOfMonth(month),
          endDate: month.getTime() === endOfMonth(now).getTime() ? endDate : endOfMonth(month)
        }));
        break;
      case 'financialyear':
        if (now.getMonth() >= 6) {
          startDate = new Date(now.getFullYear(), 6, 1); // July 1 of current year
        } else {
          startDate = new Date(now.getFullYear() - 1, 6, 1); // July 1 of previous year
        }
        const monthsFY = eachMonthOfInterval({ start: startDate, end: endDate });
        periods = monthsFY.map(month => ({
          label: format(month, 'MMM yyyy'),
          startDate: startOfMonth(month),
          endDate: month.getTime() === endOfMonth(now).getTime() ? endDate : endOfMonth(month)
        }));
        break;
      case 'custom':
        startDate = new Date(incomeStatementData.period.startDate);
        endDate = new Date(incomeStatementData.period.endDate);
        const yearsDiff = differenceInYears(endDate, startDate);
        
        // If custom period spans more than one year, show year-wise
        if (yearsDiff >= 1) {
          const years = eachYearOfInterval({ start: startDate, end: endDate });
          periods = years.map(year => {
            const yearStart = startOfYear(year);
            const yearEnd = endOfYear(year);
            
            // For the first year, use the actual start date
            const periodStart = year.getFullYear() === startDate.getFullYear() 
              ? startDate 
              : yearStart;
            
            // For the last year, use the actual end date
            const periodEnd = year.getFullYear() === endDate.getFullYear() 
              ? endDate 
              : yearEnd;
            
            return {
              label: format(year, 'yyyy'),
              startDate: periodStart,
              endDate: periodEnd
            };
          });
        } else {
          // If less than one year, show month-wise
          const months = eachMonthOfInterval({ start: startDate, end: endDate });
          periods = months.map(month => {
            const monthStart = startOfMonth(month);
            const monthEnd = endOfMonth(month);
            
            // For the first month, use the actual start date
            const periodStart = month.getTime() === startOfMonth(startDate).getTime()
              ? startDate
              : monthStart;
            
            // For the last month, use the actual end date
            const periodEnd = month.getTime() === endOfMonth(endDate).getTime()
              ? endDate
              : monthEnd;
            
            return {
              label: format(month, 'MMM yyyy'),
              startDate: periodStart,
              endDate: periodEnd
            };
          });
        }
        break;
      default:
        return [];
    }

    return periods;
  };

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
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        break;
      case 'last3month':
        // Last 3 months: go back 3 months from today
        const threeMonthsAgo = new Date(now);
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        startDate = new Date(threeMonthsAgo.getFullYear(), threeMonthsAgo.getMonth(), 1).toISOString().slice(0, 10);
        break;
      case 'last6month':
        // Last 6 months: go back 6 months from today
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(now.getMonth() - 6);
        startDate = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1).toISOString().slice(0, 10);
        break;
      case 'financialyear':
        // Financial year: July 1 to June 30
        // If current month is July-December (6-11), financial year starts July 1 of current year
        // If current month is January-June (0-5), financial year starts July 1 of previous year
        if (now.getMonth() >= 6) {
          // July-December: Financial year is July 1 of current year to today
          startDate = new Date(now.getFullYear(), 6, 1).toISOString().slice(0, 10); // July 1 (month 6)
        } else {
          // January-June: Financial year is July 1 of previous year to today
          startDate = new Date(now.getFullYear() - 1, 6, 1).toISOString().slice(0, 10); // July 1 of previous year
        }
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

  const fetchMultiPeriodBalances = async () => {
    try {
      setLoading(true);
      const subPeriods = generateSubPeriods();
      const periodsDataArray: PeriodData[] = [];

      for (const period of subPeriods) {
        const startDateStr = period.startDate.toISOString().slice(0, 10);
        const endDateStr = period.endDate.toISOString().slice(0, 10);
        
        const response = await fetch(`/api/account-books?limit=all&dateFrom=${startDateStr}&dateTo=${endDateStr}`);
        const data = await response.json();
        
        if (data.success && data.payments) {
          const balances = calculateAccountBalances(data.payments);
          const revenues = balances.filter(acc => acc.category === 'Revenue');
          const expenses = balances.filter(acc => acc.category === 'Expense');
          const vendorExpense = expenses.find(acc => acc.accountName === 'Vendor Expense');
          const vendorExpenseAmount = vendorExpense ? vendorExpense.balance : 0;
          
          const totalRevenue = revenues.reduce((sum, acc) => sum + acc.balance, 0);
          const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0);
          const grossProfit = totalRevenue - vendorExpenseAmount;
          const netIncome = totalRevenue - totalExpenses;

          periodsDataArray.push({
            periodLabel: period.label,
            startDate: startDateStr,
            endDate: endDateStr,
            revenues,
            expenses,
            totalRevenue,
            totalExpenses,
            grossProfit,
            netIncome
          });
        }
      }

      setPeriodsData(periodsDataArray);
      
      // Calculate totals across all periods
      const totalRevenue = periodsDataArray.reduce((sum, p) => sum + p.totalRevenue, 0);
      const totalExpenses = periodsDataArray.reduce((sum, p) => sum + p.totalExpenses, 0);
      const grossProfit = periodsDataArray.reduce((sum, p) => sum + p.grossProfit, 0);
      const netIncome = periodsDataArray.reduce((sum, p) => sum + p.netIncome, 0);

      // Combine all revenues and expenses for display
      const allRevenues = combineAccountBalances(periodsDataArray.map(p => p.revenues));
      const allExpenses = combineAccountBalances(periodsDataArray.map(p => p.expenses));

      setAccountBalances([...allRevenues, ...allExpenses]);
      setIncomeStatementData(prev => ({
        ...prev,
        revenues: allRevenues,
        expenses: allExpenses,
        totalRevenue,
        totalExpenses,
        grossProfit,
        netIncome,
        periods: periodsDataArray
      }));
    } catch (error) {
      console.error("Error fetching multi-period balances:", error);
      toast.error("Error loading account balances");
    } finally {
      setLoading(false);
    }
  };

  const combineAccountBalances = (balanceArrays: AccountBalance[][]): AccountBalance[] => {
    const balanceMap = new Map<number, AccountBalance>();
    
    balanceArrays.forEach(balances => {
      balances.forEach(balance => {
        const existing = balanceMap.get(balance.accountId);
        if (existing) {
          existing.balance += balance.balance;
          existing.debitAmount += balance.debitAmount;
          existing.creditAmount += balance.creditAmount;
        } else {
          balanceMap.set(balance.accountId, { ...balance });
        }
      });
    });

    return Array.from(balanceMap.values());
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
    
    // Find vendor expense specifically for gross profit calculation
    const vendorExpense = expenses.find(acc => acc.accountName === 'Vendor Expense');
    const vendorExpenseAmount = vendorExpense ? vendorExpense.balance : 0;

    const totalRevenue = revenues.reduce((sum, acc) => sum + acc.balance, 0);
    const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0);
    const grossProfit = totalRevenue - vendorExpenseAmount;
    const netIncome = totalRevenue - totalExpenses;

    setIncomeStatementData(prev => ({
      ...prev,
      revenues,
      expenses,
      totalRevenue,
      totalExpenses,
      grossProfit,
      netIncome
    }));
  };

  // Export functions
  const exportToExcel = () => {
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `income-statement-${incomeStatementData.period.startDate}-to-${incomeStatementData.period.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    
    toast.success("Income statement exported to Excel successfully");
  };

  const exportToPrint = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  const exportToPDF = () => {
    // For now, just show a message that PDF export is not implemented
    toast.info("PDF export will be implemented soon");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPeriod = () => {
    const startDate = new Date(incomeStatementData.period.startDate);
    const endDate = new Date(incomeStatementData.period.endDate);
    
    if (periodType === 'year') {
      return `for year ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'month') {
      return `for month ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'last3month') {
      return `for last 3 months ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'last6month') {
      return `for last 6 months ended ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else if (periodType === 'financialyear') {
      return `for financial year ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    } else {
      return `for period ${startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} to ${endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
  };

  const getAccountBalanceForPeriod = (accountId: number, periodData: PeriodData): number => {
    const account = [...periodData.revenues, ...periodData.expenses].find(acc => acc.accountId === accountId);
    return account?.balance || 0;
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

  const renderMultiColumnAccountRow = (account: AccountBalance, category: 'Revenue' | 'Expense') => {
    const total = periodsData.reduce((sum, period) => sum + getAccountBalanceForPeriod(account.accountId, period), 0);
    
    return (
      <tr key={account.accountId} className="border-b border-gray-200 dark:border-gray-700">
        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 w-16">{account.accountCode}</td>
        <td className="px-3 py-2 text-sm font-medium">{account.accountName}</td>
        {periodsData.map((period, idx) => {
          const balance = getAccountBalanceForPeriod(account.accountId, period);
          return (
            <td key={idx} className={`px-3 py-2 text-sm text-right font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </td>
          );
        })}
        <td className={`px-3 py-2 text-sm text-right font-bold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(total)}
        </td>
      </tr>
    );
  };

  const renderSection = (title: string, accounts: AccountBalance[], total: number, color: string, icon: React.ReactNode) => {
    if (shouldShowMultiColumn() && periodsData.length > 0) {
      const category = title === 'Revenues' ? 'Revenue' : 'Expense';
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className={`text-xl font-bold ${color}`}>{title}</h3>
          </div>
          {accounts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Code</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Account Name</th>
                    {periodsData.map((period, idx) => (
                      <th key={idx} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[100px]">
                        {period.periodLabel}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[100px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(account => renderMultiColumnAccountRow(account, category))}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 font-bold">
                    <td colSpan={2} className="px-3 py-3 text-sm">Total {title}</td>
                    {periodsData.map((period, idx) => {
                      const periodTotal = category === 'Revenue' ? period.totalRevenue : period.totalExpenses;
                      return (
                        <td key={idx} className={`px-3 py-3 text-sm text-right ${color}`}>
                          {formatCurrency(periodTotal)}
                        </td>
                      );
                    })}
                    <td className={`px-3 py-3 text-sm text-right ${color}`}>
                      {formatCurrency(total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-500 italic py-4">No {title.toLowerCase()} found for this period</div>
          )}
        </div>
      );
    }

    // Single column view (original)
    return (
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
        
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2">
              Income Statement
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {formatPeriod()}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 overflow-visible">
            <div className="flex items-center gap-2">
              <Label htmlFor="periodType" className="text-sm font-medium">Period:</Label>
              <Select
                value={periodType}
                onValueChange={(value: string) => setPeriodType(value as any)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Current Month</SelectItem>
                  <SelectItem value="last3month">Last 3 Month</SelectItem>
                  <SelectItem value="last6month">Last 6 Month</SelectItem>
                  <SelectItem value="year">Current Year</SelectItem>
                  <SelectItem value="financialyear">Financial Year</SelectItem>
                  <SelectItem value="custom">Custom Period</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {periodType === 'custom' && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 relative z-50 overflow-visible">
                <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                <div className="relative overflow-visible">
                  <Input
                    type="date"
                    value={incomeStatementData.period.startDate}
                    onChange={(e) => setIncomeStatementData(prev => ({
                      ...prev,
                      period: { ...prev.period, startDate: e.target.value }
                    }))}
                    className="w-full sm:w-44 min-w-[160px] relative z-50"
                  />
                </div>
                <span className="text-gray-500 shrink-0">to</span>
                <div className="relative overflow-visible">
                  <Input
                    type="date"
                    value={incomeStatementData.period.endDate}
                    onChange={(e) => setIncomeStatementData(prev => ({
                      ...prev,
                      period: { ...prev.period, endDate: e.target.value }
                    }))}
                    className="w-full sm:w-44 min-w-[160px] relative z-50"
                  />
                </div>
              </div>
            )}
            
                         {/* Export Dropdown */}
             <div>
               <DropdownMenu>
                 <DropdownMenuTrigger asChild>
                   <Button className="w-full sm:w-[120px] justify-between bg-blue-500 text-white hover:bg-blue-600 border-blue-500">
                     Export
                     <ArrowUp className="ml-2 h-4 w-4" />
                   </Button>
                 </DropdownMenuTrigger>
                 <DropdownMenuContent align="end" className="w-[120px]">
                   <DropdownMenuItem onClick={exportToExcel} className="flex items-center gap-2">
                     <Table className="w-4 h-4" />
                     Excel
                   </DropdownMenuItem>
                   <DropdownMenuItem onClick={exportToPrint} className="flex items-center gap-2">
                     <Printer className="w-4 h-4" />
                     Print
                   </DropdownMenuItem>
                   <DropdownMenuItem 
                     onClick={exportToPDF} 
                     className="flex items-center gap-2"
                   >
                     <FileText className="w-4 h-4" />
                     PDF
                   </DropdownMenuItem>
                 </DropdownMenuContent>
               </DropdownMenu>
             </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading income statement...</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-8">
          {/* Revenues */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800 dark:text-green-200 flex items-center">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Revenues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {renderSection("Revenues", incomeStatementData.revenues, incomeStatementData.totalRevenue, 
                "text-green-600", <TrendingUp className="w-5 h-5 text-green-600" />)}
            </CardContent>
          </Card>

          {/* Expenses */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-red-50 dark:bg-red-900/20">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-red-800 dark:text-red-200 flex items-center">
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {renderSection("Expenses", incomeStatementData.expenses, incomeStatementData.totalExpenses, 
                "text-red-600", <TrendingDown className="w-5 h-5 text-red-600" />)}
            </CardContent>
          </Card>

          {/* Net Income */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className={`${incomeStatementData.netIncome >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
              <CardTitle className={`text-lg sm:text-xl lg:text-2xl font-bold flex items-center ${incomeStatementData.netIncome >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'}`}>
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Net Income (Current Year Earnings)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6">
              {shouldShowMultiColumn() && periodsData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Item</th>
                        {periodsData.map((period, idx) => (
                          <th key={idx} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[100px]">
                            {period.periodLabel}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 min-w-[100px]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <td className="px-3 py-2 text-sm font-medium">Net Income</td>
                        {periodsData.map((period, idx) => (
                          <td key={idx} className={`px-3 py-2 text-sm text-right font-bold ${period.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(period.netIncome)}
                          </td>
                        ))}
                        <td className={`px-3 py-2 text-sm text-right font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(incomeStatementData.netIncome)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 py-4">
                  <span className="text-lg sm:text-xl font-bold">Net Income</span>
                  <span className={`text-lg sm:text-xl lg:text-2xl font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(incomeStatementData.netIncome)}
                  </span>
                </div>
              )}
              
              {incomeStatementData.netIncome >= 0 ? (
                <div className="text-xs sm:text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-lg mt-4">
                  ✅ Profitable period with positive net income
                </div>
              ) : (
                <div className="text-xs sm:text-sm text-red-600 bg-red-50 dark:bg-green-900/20 p-2 sm:p-3 rounded-lg mt-4">
                  ⚠️ Net loss for this period
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary */}
      {!loading && (
        <Card className="mt-4 sm:mt-8 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800">
            <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-6">
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                  {formatCurrency(incomeStatementData.totalRevenue)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Gross Profit</div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${incomeStatementData.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatementData.grossProfit)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Expenses</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">
                  {formatCurrency(incomeStatementData.totalExpenses)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Net Income</div>
                <div className={`text-lg sm:text-xl lg:text-2xl font-bold ${incomeStatementData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(incomeStatementData.netIncome)}
                </div>
              </div>
            </div>
            
            <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 justify-items-center">
                <div className="text-center">
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gross Profit Margin</div>
                  <div className="text-base sm:text-lg font-bold">
                    {incomeStatementData.totalRevenue > 0 
                      ? `${((incomeStatementData.grossProfit / incomeStatementData.totalRevenue) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Net Profit Margin</div>
                  <div className="text-base sm:text-lg font-bold">
                    {incomeStatementData.totalRevenue > 0 
                      ? `${((incomeStatementData.netIncome / incomeStatementData.totalRevenue) * 100).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Expense Ratio</div>
                  <div className="text-base sm:text-lg font-bold">
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
