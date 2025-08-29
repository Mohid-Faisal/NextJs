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
  const isEditMode = searchParams.get("mode") === "edit";
  const paymentId = searchParams.get("id");

  // Form state
  const [formData, setFormData] = useState({
    transactionType: "EXPENSE",
    category: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
    reference: "",
    paymentMethod: "CASH",
  });

  // Chart of accounts
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [debitAccountId, setDebitAccountId] = useState<number>(0);
  const [creditAccountId, setCreditAccountId] = useState<number>(0);
  const [accountsLoading, setAccountsLoading] = useState(false);

  // Transaction type configurations
  const transactionTypes = [
    {
      value: "EXPENSE",
      label: "Expense",
      description: "Company spending money",
    },
    {
      value: "INCOME",
      label: "Income",
      description: "Company receiving money",
    },
    {
      value: "TRANSFER",
      label: "Transfer",
      description: "Moving money between accounts",
    },
    {
      value: "EQUITY",
      label: "Equity",
      description: "Owner investments and withdrawals",
    },
    {
      value: "ADJUSTMENT",
      label: "Adjustment",
      description: "Account balance adjustments",
    },
  ];

  const categories = {
    EXPENSE: [
      "Vendor Expense",
      "Bank Charges",
      "Equipments",
      "Fuel",
      "Insurance",
      "Legal and Accounting",
      "License and Permit",
      "Maintenance and Repair",
      "Marketing and Advertising",
      "Office Supplies",
      "Packaging Material",
      "Petty",
      "Salary and Wages",
      "Taxes",
      "Tools",
      "Transportation",
      "Utilities",
    ],
    INCOME: [
      "Logistics Services Revenue",
      "Packaging Revenue",
      "Other Revenue",
    ],
    TRANSFER: [
      "Cash to Bank",
      "Bank to Cash",
      "Account Transfer",
      "Investment Transfer",
    ],
    EQUITY: ["Owner's Equity", "Current year earnings", "Retained Earnings"],
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
  }, [formData.category, formData.paymentMethod, accounts]);

  // Separate useEffect to handle transaction type changes and reset accounts
  useEffect(() => {
    if (accounts.length > 0 && formData.transactionType) {
      // Reset accounts when transaction type changes
      setDebitAccountId(0);
      setCreditAccountId(0);
      // Clear category when transaction type changes
      setFormData(prev => ({ ...prev, category: "" }));
    }
  }, [formData.transactionType, accounts]);

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
        });
        
        // Note: The Payment model doesn't have chart of accounts fields
        // The accounts will be determined by the transaction type and category
        // when the form loads
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
        body: JSON.stringify({ action: "initialize" }),
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
    const paymentMethod = formData.paymentMethod;

    // Reset accounts first
    setDebitAccountId(0);
    setCreditAccountId(0);

    if (!category) return;

    console.log('Setting default accounts for:', { transactionType, category, paymentMethod });

    // Helper function to find cash or bank account based on payment method
    const findCashOrBankAccount = () => {
      if (paymentMethod === "CASH") {
        // Prefer cash account
        return accounts.find(a => 
          a.accountName.toLowerCase().includes("cash") &&
          a.category === "Asset"
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("cash")
        );
      } else {
        // For non-cash payments, prefer bank account
        return accounts.find(a => 
          a.accountName.toLowerCase().includes("bank") &&
          a.category === "Asset"
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("current account") &&
          a.category === "Asset"
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("checking") &&
          a.category === "Asset"
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("savings") &&
          a.category === "Asset"
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("bank")
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("current account")
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("checking")
        ) || accounts.find(a => 
          a.accountName.toLowerCase().includes("savings")
        );
      }
    };

    switch (transactionType) {
      case "EXPENSE":
        // Find the specific expense account based on category
        let expenseAccount = null;
        switch (category) {
          case "Fuel":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("fuel") || a.accountName.toLowerCase().includes("petrol") || a.accountName.toLowerCase().includes("diesel"))
            );
            break;
          case "Maintenance and Repair":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("maintenance") || a.accountName.toLowerCase().includes("repair"))
            );
            break;
          case "Salary and Wages":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("salary") || a.accountName.toLowerCase().includes("wage") || a.accountName.toLowerCase().includes("payroll"))
            );
            break;
          case "Office Supplies":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("office") || a.accountName.toLowerCase().includes("supply"))
            );
            break;
          case "Marketing and Advertising":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("marketing") || a.accountName.toLowerCase().includes("advertising"))
            );
            break;
          case "Utilities":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("utility") || a.accountName.toLowerCase().includes("electricity") || a.accountName.toLowerCase().includes("water") || a.accountName.toLowerCase().includes("gas"))
            );
            break;
          case "Transportation":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("transport") || a.accountName.toLowerCase().includes("travel"))
            );
            break;
          case "Insurance":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              a.accountName.toLowerCase().includes("insurance")
            );
            break;
          case "Legal and Accounting":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("legal") || a.accountName.toLowerCase().includes("accounting") || a.accountName.toLowerCase().includes("audit"))
            );
            break;
          case "License and Permit":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("license") || a.accountName.toLowerCase().includes("permit"))
            );
            break;
          case "Tools":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              a.accountName.toLowerCase().includes("tool")
            );
            break;
          case "Equipments":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("equipment") || a.accountName.toLowerCase().includes("asset"))
            );
            break;
          case "Bank Charges":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("bank") || a.accountName.toLowerCase().includes("charge") || a.accountName.toLowerCase().includes("fee"))
            );
            break;
          case "Taxes":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("tax") || a.accountName.toLowerCase().includes("duty"))
            );
            break;
          case "Petty":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              a.accountName.toLowerCase().includes("petty")
            );
            break;
          case "Packaging Material":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("packaging") || a.accountName.toLowerCase().includes("material"))
            );
            break;
          case "Vendor Expense":
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              (a.accountName.toLowerCase().includes("vendor") || a.accountName.toLowerCase().includes("supplier"))
            );
            break;
          default:
            // Fallback: find any expense account that matches the category name
            expenseAccount = accounts.find(a => 
              a.category === "Expense" && 
              a.accountName.toLowerCase().includes(category.toLowerCase())
            );
        }

        // Find cash/bank account for credit based on payment method
        const cashAccount = findCashOrBankAccount();

        if (expenseAccount && expenseAccount.id) setDebitAccountId(expenseAccount.id);
        if (cashAccount && cashAccount.id) setCreditAccountId(cashAccount.id);
        
        console.log('EXPENSE - Selected accounts:', {
          debit: expenseAccount?.accountName,
          credit: cashAccount?.accountName,
          debitId: expenseAccount?.id,
          creditId: cashAccount?.id,
          paymentMethod
        });
        
        // Fallback: if no specific expense account found, try to find any expense account
        if (!expenseAccount) {
          const fallbackExpense = accounts.find(a => a.category === "Expense");
          if (fallbackExpense) {
            setDebitAccountId(fallbackExpense.id);
            console.log('EXPENSE - Using fallback account:', fallbackExpense.accountName);
          }
        }
        break;

      case "INCOME":
        // Find the specific revenue account based on category
        let revenueAccount = null;
        switch (category) {
          case "Logistics Services Revenue":
            revenueAccount = accounts.find(a => 
              a.category === "Revenue" && 
              (a.accountName.toLowerCase().includes("logistics") || a.accountName.toLowerCase().includes("freight") || a.accountName.toLowerCase().includes("shipping"))
            );
            break;
          case "Packaging Revenue":
            revenueAccount = accounts.find(a => 
              a.category === "Revenue" && 
              a.accountName.toLowerCase().includes("packaging")
            );
            break;
          case "Other Revenue":
            revenueAccount = accounts.find(a => 
              a.category === "Revenue" && 
              a.accountName.toLowerCase().includes("other") || a.accountName.toLowerCase().includes("miscellaneous")
            );
            break;
          default:
            // Fallback: find any revenue account that matches the category name
            revenueAccount = accounts.find(a => 
              a.category === "Revenue" && 
              a.accountName.toLowerCase().includes(category.toLowerCase())
            );
        }

        // Find cash/bank account for debit based on payment method
        const bankAccount = findCashOrBankAccount();

        if (bankAccount && bankAccount.id) setDebitAccountId(bankAccount.id);
        if (revenueAccount && revenueAccount.id) setCreditAccountId(revenueAccount.id);
        
        console.log('INCOME - Selected accounts:', {
          debit: bankAccount?.accountName,
          credit: revenueAccount?.accountName,
          debitId: bankAccount?.id,
          creditId: revenueAccount?.id,
          paymentMethod
        });
        
        // Fallback: if no specific revenue account found, try to find any revenue account
        if (!revenueAccount) {
          const fallbackRevenue = accounts.find(a => a.category === "Revenue");
          if (fallbackRevenue) {
            setCreditAccountId(fallbackRevenue.id);
            console.log('INCOME - Using fallback account:', fallbackRevenue.accountName);
          }
        }
        break;

      case "TRANSFER":
        // Find accounts based on transfer category
        let fromAccount = null;
        let toAccount = null;
        
        switch (category) {
          case "Cash to Bank":
            fromAccount = accounts.find(a => a.accountName.toLowerCase().includes("cash"));
            toAccount = accounts.find(a => 
              a.accountName.toLowerCase().includes("bank") || 
              a.accountName.toLowerCase().includes("current account") ||
              a.accountName.toLowerCase().includes("checking") ||
              a.accountName.toLowerCase().includes("savings")
            );
            break;
          case "Bank to Cash":
            fromAccount = accounts.find(a => 
              a.accountName.toLowerCase().includes("bank") || 
              a.accountName.toLowerCase().includes("current account") ||
              a.accountName.toLowerCase().includes("checking") ||
              a.accountName.toLowerCase().includes("savings")
            );
            toAccount = accounts.find(a => a.accountName.toLowerCase().includes("cash"));
            break;
          case "Account Transfer":
            // For general account transfers, default to cash and bank
            fromAccount = accounts.find(a => a.accountName.toLowerCase().includes("cash"));
            toAccount = accounts.find(a => 
              a.accountName.toLowerCase().includes("bank") || 
              a.accountName.toLowerCase().includes("current account") ||
              a.accountName.toLowerCase().includes("checking") ||
              a.accountName.toLowerCase().includes("savings")
            );
            break;
          case "Investment Transfer":
            fromAccount = accounts.find(a => 
              a.accountName.toLowerCase().includes("cash") || 
              a.accountName.toLowerCase().includes("bank") ||
              a.accountName.toLowerCase().includes("checking") ||
              a.accountName.toLowerCase().includes("savings")
            );
            toAccount = accounts.find(a => 
              a.accountName.toLowerCase().includes("investment") || 
              a.accountName.toLowerCase().includes("fixed deposit")
            );
            break;
        }

        if (fromAccount && fromAccount.id) setDebitAccountId(fromAccount.id);
        if (toAccount && toAccount.id) setCreditAccountId(toAccount.id);
        break;

      case "EQUITY":
        // Find equity accounts based on category
        let equityAccount = null;
        const cashEquity = findCashOrBankAccount();
        
        switch (category) {
          case "Owner's Equity":
            equityAccount = accounts.find(a => 
              a.category === "Equity" && 
              (a.accountName.toLowerCase().includes("owner") || a.accountName.toLowerCase().includes("capital"))
            );
            break;
          case "Current year earnings":
            equityAccount = accounts.find(a => 
              a.category === "Equity" && 
              (a.accountName.toLowerCase().includes("current") || a.accountName.toLowerCase().includes("earnings") || a.accountName.toLowerCase().includes("profit"))
            );
            break;
          case "Retained Earnings":
            equityAccount = accounts.find(a => 
              a.category === "Equity" && 
              a.accountName.toLowerCase().includes("retained")
            );
            break;
          default:
            // Default equity account
            equityAccount = accounts.find(a => 
              a.category === "Equity" && 
              (a.accountName.toLowerCase().includes("owner") || a.accountName.toLowerCase().includes("capital"))
            );
        }

        // For equity, always debit cash/bank and credit equity (assuming owner putting money in)
        if (cashEquity && cashEquity.id) setDebitAccountId(cashEquity.id);
        if (equityAccount && equityAccount.id) setCreditAccountId(equityAccount.id);
        
        console.log('EQUITY - Selected accounts:', {
          debit: cashEquity?.accountName,
          credit: equityAccount?.accountName,
          debitId: cashEquity?.id,
          creditId: equityAccount?.id,
          paymentMethod
        });
        break;

      case "ADJUSTMENT":
        // For adjustments, default to cash and a general adjustment account
        const cashAdjustment = findCashOrBankAccount();
        const adjustmentAccount = accounts.find(a => 
          a.category === "Asset" && 
          !a.accountName.toLowerCase().includes("cash") &&
          !a.accountName.toLowerCase().includes("bank") &&
          !a.accountName.toLowerCase().includes("checking") &&
          !a.accountName.toLowerCase().includes("savings")
        );

        if (cashAdjustment && cashAdjustment.id) setDebitAccountId(cashAdjustment.id);
        if (adjustmentAccount && adjustmentAccount.id) setCreditAccountId(adjustmentAccount.id);
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

    if (isEditMode) {
      // In edit mode, only update the amount and journal entry
      console.log(`Updating payment ${paymentId} with new amount: ${formData.amount}`);
      console.log(`updateJournalEntry flag: true`);
      
      try {
        const response = await fetch(`/api/accounts/payments/${paymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: parseFloat(formData.amount),
            updateJournalEntry: true // Flag to update journal entry
          }),
        });

        const data = await response.json();
        console.log(`PATCH response:`, data);

        if (response.ok && data.success) {
          toast.success("Payment amount updated successfully");
          router.push("/dashboard/accounts/payments");
        } else {
          toast.error(data.message || "Failed to update payment amount");
        }
      } catch (error) {
        console.error("Error updating payment:", error);
        toast.error("An unexpected error occurred");
      }
      return;
    }

    // Original logic for creating new payments
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

        // Chart of accounts
        debitAccountId,
        creditAccountId,

        // All internal transactions (no external parties)
        fromPartyType: "US",
        toPartyType: "US",
      };

      const response = await fetch("/api/accounts/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Transaction added successfully");
        router.push("/dashboard/accounts/payments");
      } else {
        toast.error(data.message || "Failed to add transaction");
      }
    } catch (error) {
      console.error("Error saving payment:", error);
      toast.error("An unexpected error occurred");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out">
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white mb-2 sm:mb-3">
          {isEditMode ? "Edit Transaction Amount" : "Add Transaction"}
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400">
          {isEditMode 
            ? "Update the transaction amount and corresponding journal entry"
            : "Create internal company transactions with proper chart of accounts integration"
          }
        </p>
        {isEditMode && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> In edit mode, only the amount field can be modified. All other fields are read-only to maintain data integrity.
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Basic Information */}
          <Card className="xl:col-span-2">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="text-lg sm:text-xl">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Transaction Type *
                  </Label>
                  <Select
                    value={formData.transactionType}
                    onValueChange={(value) =>
                      handleInputChange("transactionType", value)
                    }
                    disabled={isEditMode}
                  >
                    <SelectTrigger className="w-full h-8 sm:h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="font-medium">{type.label}</div>
                          <span className="text-xs text-gray-500">
                            {type.description}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Category *
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      handleInputChange("category", value)
                    }
                    disabled={isEditMode}
                  >
                    <SelectTrigger className="w-full h-8 sm:h-8">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories[
                        formData.transactionType as keyof typeof categories
                      ]?.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Date *
                  </Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    required
                    className="h-8 sm:h-8"
                    disabled={isEditMode}
                  />
                </div>

                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Amount *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      handleInputChange("amount", e.target.value)
                    }
                    required
                    className="h-8 sm:h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Payment Method
                  </Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      handleInputChange("paymentMethod", value)
                    }
                    disabled={isEditMode}
                  >
                    <SelectTrigger className="w-full h-8 sm:h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                    Reference
                  </Label>
                  <Input
                    value={formData.reference}
                    onChange={(e) =>
                      handleInputChange("reference", e.target.value)
                    }
                    placeholder="Transaction reference number"
                    className="h-8 sm:h-8"
                    disabled={isEditMode}
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                  Description
                </Label>
                <Input
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange("description", e.target.value)
                  }
                  placeholder="Transaction description"
                  className="h-8 sm:h-10"
                  disabled={isEditMode}
                />
              </div>
            </CardContent>
          </Card>

          {/* Chart of Accounts Section */}
          {!isEditMode && (
            <Card>
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="text-lg sm:text-xl">Chart of Accounts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6">
                {accounts.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <p className="text-red-500 mb-4 text-sm sm:text-base">
                      No chart of accounts found
                    </p>
                    <Button
                      type="button"
                      onClick={initializeChartOfAccounts}
                      disabled={accountsLoading}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      {accountsLoading
                        ? "Initializing..."
                        : "Initialize Chart of Accounts"}
                    </Button>
                  </div>
                ) : !formData.category ? (
                  <div className="text-center py-8 sm:py-10">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <Info className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select a Category First
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Choose a transaction type and category to automatically populate the chart of accounts
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                            How it works:
                          </p>
                          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                            <li>• <strong>Expense:</strong> Debit expense account, Credit cash/bank</li>
                            <li>• <strong>Income:</strong> Debit cash/bank, Credit revenue account</li>
                            <li>• <strong>Transfer:</strong> Debit destination, Credit source account</li>
                            <li>• <strong>Equity:</strong> Debit cash/bank, Credit equity account</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                        Debit Account *
                      </Label>
                      <Select
                        value={String(debitAccountId)}
                        onValueChange={(value) => {
                          if (value && value !== "") {
                            setDebitAccountId(parseInt(value));
                          }
                        }}
                        disabled={isEditMode}
                      >
                        <SelectTrigger className="w-full h-10 sm:h-12">
                          <SelectValue placeholder="Select debit account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={String(account.id)}
                            >
                              <div className="font-medium">
                                {account.code} - {account.accountName}
                              </div>
                              <span className="text-xs text-gray-500">
                                {account.category} • {account.type}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm sm:text-base font-medium mb-2 sm:mb-3 block">
                        Credit Account *
                      </Label>
                      <Select
                        value={String(creditAccountId)}
                        onValueChange={(value) => {
                          if (value && value !== "") {
                            setCreditAccountId(parseInt(value));
                          }
                        }}
                        disabled={isEditMode}
                      >
                        <SelectTrigger className="w-full h-10 sm:h-12">
                          <SelectValue placeholder="Select credit account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem
                              key={account.id}
                              value={String(account.id)}
                            >
                              <div className="font-medium">
                                {account.code} - {account.accountName}
                              </div>
                              <span className="text-xs text-gray-500">
                                {account.category} • {account.type}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Account Balance Preview */}
                    {debitAccountId && creditAccountId && (
                      <div className="p-4 sm:p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border">
                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                          <Info className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
                          <span className="font-semibold text-sm sm:text-base">
                            Transaction Preview
                          </span>
                        </div>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-red-600 font-medium text-sm sm:text-base">
                              Debit:
                            </span>
                            <span className="font-medium text-sm sm:text-base">
                              {
                                accounts.find((a) => a.id === debitAccountId)
                                  ?.accountName
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-green-600 font-medium text-sm sm:text-base">
                              Credit:
                            </span>
                            <span className="font-medium text-sm sm:text-base">
                              {
                                accounts.find((a) => a.id === creditAccountId)
                                  ?.accountName
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-semibold text-sm sm:text-base">
                              Amount:
                            </span>
                            <span className="font-semibold text-sm sm:text-base">
                              PKR{" "}
                              {parseFloat(
                                formData.amount || "0"
                              ).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Submit Button */}
        <div className="mt-6 sm:mt-8 lg:mt-10 flex justify-end">
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 lg:px-10 py-2 sm:py-3 text-base sm:text-lg font-medium w-full sm:w-auto"
            disabled={isEditMode ? false : (accountsLoading || accounts.length === 0)}
          >
            {isEditMode ? "Update Amount" : "Save Transaction"}
          </Button>
        </div>
      </form>
    </div>
  );
}
