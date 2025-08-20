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
import { ArrowLeft, Info } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type ChartOfAccount = {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
};

export default function AddPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const paymentId = searchParams.get('id');

  // Form state
  const [formData, setFormData] = useState({
    transactionType: "EXPENSE",
    category: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    reference: "",
    paymentMethod: "CASH",
    dueDate: "",
  });

  // Chart of accounts
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [debitAccountId, setDebitAccountId] = useState<number>(0);
  const [creditAccountId, setCreditAccountId] = useState<number>(0);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Transaction type configurations
  const transactionTypes = [
    { value: "EXPENSE", label: "Expense", description: "Company spending money" },
    { value: "INCOME", label: "Income", description: "Company receiving money" },
    { value: "TRANSFER", label: "Transfer", description: "Moving money between accounts" },
    { value: "EQUITY", label: "Equity", description: "Owner investments and withdrawals" },
    { value: "ADJUSTMENT", label: "Adjustment", description: "Account balance adjustments" },
  ];

  const categories = {
    EXPENSE: [
      "Operations Cost",
      "Fuel Costs", 
      "Vehicle Maintenance",
      "Driver Salaries",
      "Warehouse Rent",
      "Utilities Expense",
      "Administrative Salaries",
      "Insurance Expense",
      "Depreciation Expense",
      "Office Supplies",
      "Travel Expense",
      "Marketing Expense",
    ],
    INCOME: [
      "Freight Revenue",
      "Logistics Services Revenue", 
      "Vehicle Leasing Revenue",
      "Other Income",
      "Interest Income",
      "Commission Income",
    ],
    TRANSFER: [
      "Cash to Bank",
      "Bank to Cash",
      "Account Transfer",
      "Investment Transfer",
    ],
    EQUITY: [
      "Owner Investment",
      "Owner Withdrawal",
      "Capital Contribution",
      "Dividend Payment",
      "Retained Earnings",
      "Share Capital",
    ],
    ADJUSTMENT: [
      "Balance Adjustment",
      "Write-off",
      "Revaluation",
      "Correction Entry",
    ],
  };

  const paymentMethods = [
    { value: "CASH", label: "Cash" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "CARD", label: "Card" },
    { value: "CHEQUE", label: "Cheque" },
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      setDefaultAccounts();
    }
  }, [formData.transactionType, formData.category, accounts]);

  const loadData = async () => {
    try {
      setAccountsLoading(true);
      const accountsRes = await fetch("/api/chart-of-accounts?limit=1000");
      const accountsData = await accountsRes.json();

      if (accountsData.success && accountsData.data) {
        setAccounts(accountsData.data);
      }

      // Load edit data if in edit mode
      if (isEditMode && paymentId) {
        loadEditData();
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadEditData = async () => {
    try {
      const response = await fetch(`/api/accounts/payments/${paymentId}`);
      const data = await response.json();
      
      if (data.success && data.payment) {
        const payment = data.payment;
        setFormData({
          transactionType: payment.transactionType,
          category: payment.category,
          date: new Date(payment.date).toISOString().slice(0, 10),
          amount: payment.amount.toString(),
          description: payment.description || "",
          reference: payment.reference || "",
          paymentMethod: payment.mode || "CASH",
          dueDate: payment.dueDate ? new Date(payment.dueDate).toISOString().slice(0, 10) : "",
        });
      }
    } catch (error) {
      console.error("Error loading edit data:", error);
      toast.error("Failed to load payment data");
    }
  };

  const initializeChartOfAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await fetch("/api/chart-of-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        window.location.reload();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error initializing accounts:", error);
      toast.error("Failed to initialize chart of accounts");
    } finally {
      setAccountsLoading(false);
    }
  };

  const setDefaultAccounts = () => {
    const transactionType = formData.transactionType;
    const category = formData.category;
    
    switch (transactionType) {
      case "EXPENSE":
        // Debit: Expense account, Credit: Cash/Bank
        const expenseAccount = accounts.find(a => 
          a.category === "Expense" && 
          (a.accountName.includes("Fuel") || a.accountName.includes("Maintenance") || a.accountName.includes("Salaries"))
        );
        const cashAccount = accounts.find(a => a.accountName === "Cash");
        
        if (expenseAccount) setDebitAccountId(expenseAccount.id);
        if (cashAccount) setCreditAccountId(cashAccount.id);
        break;

      case "INCOME":
        // Debit: Cash/Bank, Credit: Revenue account
        const revenueAccount = accounts.find(a => 
          a.category === "Revenue" && 
          (a.accountName.includes("Freight") || a.accountName.includes("Services"))
        );
        const bankAccount = accounts.find(a => a.accountName === "Cash");
        
        if (bankAccount) setDebitAccountId(bankAccount.id);
        if (revenueAccount) setCreditAccountId(revenueAccount.id);
        break;

      case "TRANSFER":
        // Debit: Destination account, Credit: Source account
        const bankAccountTransfer = accounts.find(a => a.accountName.includes("Bank") || a.accountName === "Accounts Receivable");
        const cashAccountTransfer = accounts.find(a => a.accountName === "Cash");
        
        if (bankAccountTransfer) setDebitAccountId(bankAccountTransfer.id);
        if (cashAccountTransfer) setCreditAccountId(cashAccountTransfer.id);
        break;

      case "EQUITY":
        // For equity transactions, the direction depends on the category
        const cashEquity = accounts.find(a => a.accountName === "Cash");
        const ownerEquity = accounts.find(a => a.category === "Equity" && a.accountName.includes("Owner"));
        const retainedEarnings = accounts.find(a => a.category === "Equity" && a.accountName.includes("Retained"));
        const shareCapital = accounts.find(a => a.category === "Equity" && a.accountName.includes("Share"));
        
        // Default equity account (prefer Owner Equity, then Retained Earnings, then Share Capital)
        const defaultEquityAccount = ownerEquity || retainedEarnings || shareCapital;
        
        // Determine direction based on category
        const isInvestment = category === "Owner Investment" || category === "Capital Contribution" || category === "Share Capital";
        const isWithdrawal = category === "Owner Withdrawal" || category === "Dividend Payment";
        
        if (isInvestment) {
          // Owner putting money in: Debit Cash, Credit Equity
          if (cashEquity) setDebitAccountId(cashEquity.id);
          if (defaultEquityAccount) setCreditAccountId(defaultEquityAccount.id);
        } else if (isWithdrawal) {
          // Owner taking money out: Debit Equity, Credit Cash
          if (defaultEquityAccount) setDebitAccountId(defaultEquityAccount.id);
          if (cashEquity) setCreditAccountId(cashEquity.id);
        } else {
          // Default: Debit Cash, Credit Equity
          if (cashEquity) setDebitAccountId(cashEquity.id);
          if (defaultEquityAccount) setCreditAccountId(defaultEquityAccount.id);
        }
        break;

      case "ADJUSTMENT":
        // Default to Cash for adjustments
        const cashAdjustment = accounts.find(a => a.accountName === "Cash");
        const adjustmentAccount = accounts.find(a => a.category === "Asset" && a.accountName !== "Cash");
        
        if (cashAdjustment) setDebitAccountId(cashAdjustment.id);
        if (adjustmentAccount) setCreditAccountId(adjustmentAccount.id);
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!debitAccountId || !creditAccountId) {
      toast.error("Please select both debit and credit accounts");
      return;
    }

    if (debitAccountId === creditAccountId) {
      toast.error("Debit and credit accounts must be different");
      return;
    }

    try {
      const payload = {
        transactionType: formData.transactionType,
        category: formData.category,
        date: new Date(formData.date).toISOString(),
        amount: parseFloat(formData.amount),
        description: formData.description,
        reference: formData.reference,
        paymentMethod: formData.paymentMethod,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        
        // Chart of accounts
        debitAccountId,
        creditAccountId,
        
        // All internal transactions (no external parties)
        fromPartyType: "US",
        toPartyType: "US",
      };

      const url = isEditMode && paymentId 
        ? `/api/accounts/payments/${paymentId}`
        : `/api/accounts/payments`;
      
      const method = isEditMode ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Payment ${isEditMode ? 'updated' : 'added'} successfully`);
        router.push("/dashboard/accounts/payments");
      } else {
        toast.error(data.message || `Failed to ${isEditMode ? 'update' : 'add'} payment`);
      }
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">
          {isEditMode ? 'Edit Payment' : 'Add Payment'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          Create internal company transactions with proper chart of accounts integration
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Basic Information */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-6">
              <CardTitle className="text-xl">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-base font-medium mb-3 block">Transaction Type *</Label>
                  <Select 
                    value={formData.transactionType} 
                    onValueChange={(value) => handleInputChange('transactionType', value)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-gray-500">{type.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-base font-medium mb-3 block">Category *</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(value) => handleInputChange('category', value)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[formData.transactionType as keyof typeof categories]?.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-base font-medium mb-3 block">Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="h-12"
                    required
                  />
                </div>
                <div>
                  <Label className="text-base font-medium mb-3 block">Due Date</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleInputChange('dueDate', e.target.value)}
                    className="h-12"
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-medium mb-3 block">Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="0.00"
                  className="h-12"
                  required
                />
              </div>

              <div>
                <Label className="text-base font-medium mb-3 block">Payment Method</Label>
                <Select 
                  value={formData.paymentMethod} 
                  onValueChange={(value) => handleInputChange('paymentMethod', value)}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-base font-medium mb-3 block">Reference</Label>
                <Input
                  value={formData.reference}
                  onChange={(e) => handleInputChange('reference', e.target.value)}
                  placeholder="Transaction reference number"
                  className="h-12"
                />
              </div>

              <div>
                <Label className="text-base font-medium mb-3 block">Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Transaction description"
                  className="h-12"
                />
              </div>
            </CardContent>
          </Card>

          {/* Chart of Accounts */}
          <Card>
            <CardHeader className="pb-6">
              <CardTitle className="text-xl">Chart of Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {accounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-4">No chart of accounts found</p>
                  <Button
                    type="button"
                    onClick={initializeChartOfAccounts}
                    disabled={accountsLoading}
                    variant="outline"
                  >
                    {accountsLoading ? "Initializing..." : "Initialize Chart of Accounts"}
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-base font-medium mb-3 block">Debit Account *</Label>
                    <Select 
                      value={String(debitAccountId)} 
                      onValueChange={(value) => setDebitAccountId(parseInt(value))}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select debit account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            <div>
                              <div className="font-medium">{account.code} - {account.accountName}</div>
                              <div className="text-xs text-gray-500">{account.category} • {account.type}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-base font-medium mb-3 block">Credit Account *</Label>
                    <Select 
                      value={String(creditAccountId)} 
                      onValueChange={(value) => setCreditAccountId(parseInt(value))}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select credit account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            <div>
                              <div className="font-medium">{account.code} - {account.accountName}</div>
                              <div className="text-xs text-gray-500">{account.category} • {account.type}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Account Balance Preview */}
                  {debitAccountId && creditAccountId && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                      <div className="flex items-center gap-3 mb-4">
                        <Info className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-base">Transaction Preview</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-red-600 font-medium">Debit:</span>
                          <span className="font-medium">{accounts.find(a => a.id === debitAccountId)?.accountName}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 font-medium">Credit:</span>
                          <span className="font-medium">{accounts.find(a => a.id === creditAccountId)?.accountName}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="font-semibold text-base">Amount:</span>
                          <span className="font-semibold text-base">PKR {parseFloat(formData.amount || '0').toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Submit Button */}
        <div className="mt-10 flex justify-end">
          <Button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-3 text-lg font-medium"
            disabled={accountsLoading || accounts.length === 0}
          >
            {isEditMode ? 'Update Payment' : 'Save Payment'}
          </Button>
        </div>
      </form>
    </div>
  );
}


