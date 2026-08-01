"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, TrendingUp, Scale, Table, Printer, FileText, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportRowsToExcel, exportRowsToPDF, exportRowsToPrint } from "@/lib/exportReports";

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
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData>({
    assets: { current: [], fixed: [], total: 0 },
    liabilities: { current: [], nonCurrent: [], total: 0 },
    equity: [],
    totalEquity: 0,
    totalLiabilitiesAndEquity: 0
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      fetchDataAndCalculate();
    }
  }, [accounts, asOfDate]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/chart-of-accounts?limit=1000");
      const data = await response.json();
      
      if (data.success && data.data) {
        setAccounts(data.data);
      } else {
        toast.error("Failed to load chart of accounts");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Error loading chart of accounts");
    } finally {
      setLoading(false);
    }
  };

  const fetchDataAndCalculate = async () => {
    try {
      setLoading(true);

      // Parse date and calculate financial year start date (July 1 to June 30)
      const dateParts = asOfDate.split('-').map(Number);
      const year = dateParts[0] || new Date().getFullYear();
      const month = dateParts[1] || 1;
      const monthIndex = month - 1; // 0-indexed month

      let fyStartDateStr: string;
      if (monthIndex >= 6) {
        // July - Dec: Financial year started July 1 of current year
        fyStartDateStr = `${year}-07-01`;
      } else {
        // Jan - June: Financial year started July 1 of previous year
        fyStartDateStr = `${year - 1}-07-01`;
      }
      const fyStartDate = new Date(fyStartDateStr + 'T00:00:00.000Z');

      // Fetch all journal entry lines up to asOfDate
      const response = await fetch(`/api/account-books?limit=all&dateTo=${asOfDate}`);
      const data = await response.json();

      if (!data.success || !data.payments) {
        toast.error("Failed to load account balances");
        return;
      }

      const entries: any[] = data.payments;
      const balanceMap = new Map<number, AccountBalance>();

      // Pre-fill balance map with all defined Chart of Accounts (excluding dynamic CYE)
      accounts.forEach(account => {
        const nameLower = account.accountName.toLowerCase();
        if (nameLower.includes('current year earnings') || nameLower.includes('current year earning')) {
          return; // CYE is dynamically calculated below
        }

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

      let currentYearRevenue = 0;
      let currentYearExpense = 0;
      let priorYearRevenue = 0;
      let priorYearExpense = 0;

      // Process each transaction line
      entries.forEach(entry => {
        if (!entry.accountId) return;

        const debitAmount = Number(entry.debitAmount) || 0;
        const creditAmount = Number(entry.creditAmount) || 0;
        const entryDate = entry.date ? new Date(entry.date) : new Date(0);

        const account = accounts.find(acc => acc.id === entry.accountId);
        if (!account) return;

        const cat = account.category;

        if (cat === 'Revenue') {
          const netCredit = creditAmount - debitAmount;
          if (entryDate >= fyStartDate) {
            currentYearRevenue += netCredit;
          } else {
            priorYearRevenue += netCredit;
          }
          return;
        }

        if (cat === 'Expense') {
          const netDebit = debitAmount - creditAmount;
          if (entryDate >= fyStartDate) {
            currentYearExpense += netDebit;
          } else {
            priorYearExpense += netDebit;
          }
          return;
        }

        // Assets, Liabilities, and Equity
        const current = balanceMap.get(entry.accountId);
        if (!current) return;

        let newBalance = current.balance;
        switch (cat) {
          case 'Asset':
            newBalance += debitAmount - creditAmount;
            break;
          case 'Liability':
          case 'Equity':
            newBalance += creditAmount - debitAmount;
            break;
          default:
            newBalance += debitAmount - creditAmount;
        }

        balanceMap.set(entry.accountId, {
          ...current,
          balance: newBalance,
          debitAmount: current.debitAmount + debitAmount,
          creditAmount: current.creditAmount + creditAmount
        });
      });

      // Dynamic Earnings Calculations
      const currentYearEarnings = currentYearRevenue - currentYearExpense;
      const priorPeriodNetIncome = priorYearRevenue - priorYearExpense;

      const accountBalances = Array.from(balanceMap.values());

      const assets = accountBalances.filter(acc => acc.category === 'Asset');
      const liabilities = accountBalances.filter(acc => acc.category === 'Liability');
      const baseEquity = accountBalances.filter(acc => acc.category === 'Equity');

      // Categorize Assets
      const fixedAssets = assets.filter(acc => {
        const typeLower = (acc.type || '').toLowerCase();
        const nameLower = acc.accountName.toLowerCase();
        return typeLower.includes('fixed') ||
               nameLower.includes('furniture') ||
               nameLower.includes('equipment') ||
               nameLower.includes('building') ||
               nameLower.includes('facility') ||
               nameLower.includes('warehousing');
      });

      const currentAssets = assets.filter(acc => !fixedAssets.some(f => f.accountId === acc.accountId));

      // Categorize Liabilities
      const nonCurrentLiabilities = liabilities.filter(acc => {
        const typeLower = (acc.type || '').toLowerCase();
        const nameLower = acc.accountName.toLowerCase();
        return typeLower.includes('non-current') ||
               typeLower.includes('long') ||
               nameLower.includes('loan') ||
               nameLower.includes('mortgage');
      });

      const currentLiabilities = liabilities.filter(acc => !nonCurrentLiabilities.some(nc => nc.accountId === acc.accountId));

      // Build Equity Section with CYE and Retained Earnings
      const cyeAccountDef = accounts.find(a => a.accountName.toLowerCase().includes('current year earning'));
      const reAccountDef = accounts.find(a => a.accountName.toLowerCase().includes('retained earning'));

      const cyeAccount: AccountBalance = {
        accountId: cyeAccountDef?.id || -101,
        accountCode: cyeAccountDef?.code || '3103',
        accountName: cyeAccountDef?.accountName || 'Current Year Earnings',
        category: 'Equity',
        type: 'Equity',
        balance: currentYearEarnings,
        debitAmount: 0,
        creditAmount: 0
      };

      let finalEquity: AccountBalance[] = [];
      let reFound = false;

      baseEquity.forEach(acc => {
        if (acc.accountName.toLowerCase().includes('retained earning')) {
          reFound = true;
          finalEquity.push({
            ...acc,
            balance: acc.balance + priorPeriodNetIncome
          });
        } else {
          finalEquity.push(acc);
        }
      });

      if (!reFound) {
        const reAccount: AccountBalance = {
          accountId: reAccountDef?.id || -102,
          accountCode: reAccountDef?.code || '3102',
          accountName: reAccountDef?.accountName || 'Retained Earnings',
          category: 'Equity',
          type: 'Equity',
          balance: priorPeriodNetIncome,
          debitAmount: 0,
          creditAmount: 0
        };
        finalEquity.push(reAccount);
      }

      // Prepend CYE to Equity
      finalEquity.unshift(cyeAccount);

      // Totals
      const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
      const totalEquity = finalEquity.reduce((sum, acc) => sum + acc.balance, 0);
      const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

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
        equity: finalEquity,
        totalEquity,
        totalLiabilitiesAndEquity
      });
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      toast.error("Error generating balance sheet");
    } finally {
      setLoading(false);
    }
  };

  const getExportData = () => {
    const headers = ["Category", "Account Code", "Account Name", "Balance"];
    const rows = [
      ...balanceSheetData.assets.current.map(acc => [
        "Current Assets",
        acc.accountCode,
        acc.accountName,
        acc.balance.toLocaleString()
      ]),
      ...balanceSheetData.assets.fixed.map(acc => [
        "Fixed Assets",
        acc.accountCode,
        acc.accountName,
        acc.balance.toLocaleString()
      ]),
      ["", "", "Total Assets", balanceSheetData.assets.total.toLocaleString()],
      ["", "", "", ""],
      ...balanceSheetData.liabilities.current.map(acc => [
        "Current Liabilities",
        acc.accountCode,
        acc.accountName,
        acc.balance.toLocaleString()
      ]),
      ...balanceSheetData.liabilities.nonCurrent.map(acc => [
        "Non-Current Liabilities",
        acc.accountCode,
        acc.accountName,
        acc.balance.toLocaleString()
      ]),
      ["", "", "Total Liabilities", balanceSheetData.liabilities.total.toLocaleString()],
      ["", "", "", ""],
      ...balanceSheetData.equity.map(acc => [
        "Equity",
        acc.accountCode,
        acc.accountName,
        acc.balance.toLocaleString()
      ]),
      ["", "", "Total Equity", balanceSheetData.totalEquity.toLocaleString()],
      ["", "", "Total Liabilities & Equity", balanceSheetData.totalLiabilitiesAndEquity.toLocaleString()],
    ];
    return { headers, rows };
  };

  const exportToExcel = () => {
    const { headers, rows } = getExportData();
    exportRowsToExcel(rows, headers, `balance_sheet_${asOfDate}`);
    toast.success("Balance sheet exported successfully");
  };

  const exportToPrint = () => {
    const { headers, rows } = getExportData();
    exportRowsToPrint(rows, headers, "Balance Sheet", `As of ${asOfDate}`);
  };

  const exportToPDF = async () => {
    const { headers, rows } = getExportData();
    await exportRowsToPDF(rows, headers, "Balance Sheet", `As of ${asOfDate}`);
    toast.success("Balance sheet PDF exported");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderAccountRow = (account: AccountBalance, indent: boolean = false) => (
    <div key={account.accountId} className={`flex justify-between items-center py-1.5 ${indent ? 'ml-6' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{account.accountCode}</span>
        <span className="text-sm font-medium">{account.accountName}</span>
      </div>
      <span className={`text-sm font-bold ${account.balance >= 0 ? 'text-gray-800 dark:text-gray-200' : 'text-red-600'}`}>
        {formatCurrency(account.balance)}
      </span>
    </div>
  );

  const renderSection = (title: string, accounts: AccountBalance[], total: number, colorClass: string) => (
    <div className="space-y-2">
      <h4 className={`text-sm font-bold uppercase tracking-wider ${colorClass}`}>{title}</h4>
      {accounts.length > 0 ? (
        <>
          {accounts.map(account => renderAccountRow(account, true))}
          <div className="flex justify-between items-center py-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-semibold text-sm">Total {title}</span>
            <span className={`font-bold ${colorClass}`}>{formatCurrency(total)}</span>
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-500 italic ml-6 py-1">No accounts found</div>
      )}
    </div>
  );

  const isBalanced = Math.abs(balanceSheetData.assets.total - balanceSheetData.totalLiabilitiesAndEquity) <= 0.01;

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-3">
              <Scale className="w-8 h-8 text-blue-600 dark:text-blue-400" />
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  disabled={loading}
                  className="w-[120px] justify-between bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Export
                  <Upload className="ml-2 h-4 w-4" />
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
                <DropdownMenuItem onClick={exportToPDF} className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading balance sheet...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-8 items-start">
          {/* ASSETS COLUMN */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800/30">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-green-800 dark:text-green-200 flex items-center">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 mr-2" />
                Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {renderSection("Current Assets", balanceSheetData.assets.current, 
                balanceSheetData.assets.current.reduce((sum, acc) => sum + acc.balance, 0), 
                "text-green-600")}
              
              {renderSection("Fixed Assets", balanceSheetData.assets.fixed, 
                balanceSheetData.assets.fixed.reduce((sum, acc) => sum + acc.balance, 0), 
                "text-green-600")}
              
              <div className="flex justify-between items-center pt-4 border-t-2 border-green-300 dark:border-green-700 mt-6">
                <span className="text-xl font-bold text-green-900 dark:text-green-100">Total Assets</span>
                <span className="text-xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(balanceSheetData.assets.total)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* LIABILITIES & EQUITY COLUMN */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardHeader className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800/30">
              <CardTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-200">
                Liabilities & Equity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Liabilities Section */}
              <div className="space-y-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-bold text-red-800 dark:text-red-300 uppercase tracking-wide border-b pb-1 border-red-100 dark:border-red-900/30">
                  Liabilities
                </h3>
                {renderSection("Current Liabilities", balanceSheetData.liabilities.current, 
                  balanceSheetData.liabilities.current.reduce((sum, acc) => sum + acc.balance, 0), 
                  "text-red-600")}
                
                {renderSection("Non-Current Liabilities", balanceSheetData.liabilities.nonCurrent, 
                  balanceSheetData.liabilities.nonCurrent.reduce((sum, acc) => sum + acc.balance, 0), 
                  "text-red-600")}
                
                <div className="flex justify-between items-center py-2 border-t border-red-200 dark:border-red-800">
                  <span className="font-bold text-red-900 dark:text-red-200">Total Liabilities</span>
                  <span className="font-bold text-lg text-red-700 dark:text-red-400">
                    {formatCurrency(balanceSheetData.liabilities.total)}
                  </span>
                </div>
              </div>

              {/* Equity Section */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wide border-b pb-1 border-blue-100 dark:border-blue-900/30">
                  Equity
                </h3>
                {balanceSheetData.equity.length > 0 ? (
                  <>
                    {balanceSheetData.equity.map(account => renderAccountRow(account, true))}
                    <div className="flex justify-between items-center py-2 border-t border-blue-200 dark:border-blue-800">
                      <span className="font-bold text-blue-900 dark:text-blue-200">Total Equity</span>
                      <span className="font-bold text-lg text-blue-700 dark:text-blue-400">
                        {formatCurrency(balanceSheetData.totalEquity)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-500 italic ml-6">No equity accounts found</div>
                )}
              </div>

              {/* Total Liabilities & Equity */}
              <div className="flex justify-between items-center pt-4 border-t-2 border-blue-300 dark:border-blue-700 mt-6">
                <span className="text-xl font-bold text-blue-900 dark:text-blue-100">Total Liabilities & Equity</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Card */}
      {!loading && (
        <Card className="mt-4 sm:mt-8 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700">
          <CardHeader className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <CardTitle className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
              Financial Balance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/10 rounded-xl">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Assets</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                  {formatCurrency(balanceSheetData.assets.total)}
                </div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/10 rounded-xl">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Liabilities</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">
                  {formatCurrency(balanceSheetData.liabilities.total)}
                </div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Total Equity</div>
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                  {formatCurrency(balanceSheetData.totalEquity)}
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span className="text-base sm:text-lg font-bold">Total Liabilities & Equity</span>
                <span className="text-base sm:text-lg font-bold text-blue-700 dark:text-blue-400">
                  {formatCurrency(balanceSheetData.totalLiabilitiesAndEquity)}
                </span>
              </div>
              
              {!isBalanced ? (
                <div className="mt-3 text-xs sm:text-sm text-orange-700 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-800">
                  ⚠️ Balance sheet is not balanced. Difference: {formatCurrency(
                    balanceSheetData.assets.total - balanceSheetData.totalLiabilitiesAndEquity
                  )}
                </div>
              ) : (
                <div className="mt-3 text-xs sm:text-sm text-green-700 bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800 font-medium flex items-center gap-2">
                  ✓ Balance sheet is balanced (Assets = Liabilities + Equity)
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
