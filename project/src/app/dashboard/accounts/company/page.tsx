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
import { Plus, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type CompanyAccount = {
  id: number;
  name: string;
  currentBalance: number;
};

type Transaction = {
  id: number;
  type: string;
  amount: number;
  description: string;
  reference?: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
};

type PaymentStats = {
  cash: {
    inflow: number;
    outflow: number;
    net: number;
  };
  bank: {
    inflow: number;
    outflow: number;
    net: number;
  };
  total: {
    inflow: number;
    outflow: number;
    net: number;
  };
};

export default function CompanyAccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<CompanyAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "CREDIT",
    amount: "",
    description: "",
    reference: ""
  });

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const [accountResponse, statsResponse] = await Promise.all([
        fetch("/api/accounts/company"),
        fetch("/api/accounts/company/stats")
      ]);
      
      const accountData = await accountResponse.json();
      const statsData = await statsResponse.json();
      
      if (accountResponse.ok) {
        setAccount(accountData.account);
        setTransactions(accountData.transactions);
      } else {
        console.error("Error fetching company data:", accountData.error);
      }
      
      if (statsResponse.ok) {
        setPaymentStats(statsData.stats);
      } else {
        console.error("Error fetching payment stats:", statsData.error);
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/accounts/company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Reset form and refresh data
        setFormData({
          type: "CREDIT",
          amount: "",
          description: "",
          reference: ""
        });
        setShowAddForm(false);
        fetchCompanyData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error adding transaction:", error);
      alert("Failed to add transaction");
    }
  };

  if (loading) {
    return (
      <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
        <div className="text-center">Company account not found</div>
      </div>
    );
  }

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
          Company Account
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {account.name}
        </p>
      </div>

      {/* Company Balance Card */}
      <Card className="mb-6 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-gray-800 dark:text-white">
            Company Balance
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <div className="text-4xl font-bold mb-2">
            <span
              className={
                account.currentBalance > 0
                  ? "text-green-600 dark:text-green-400"
                  : account.currentBalance < 0
                  ? "text-red-600 dark:text-red-400"
                  : "text-gray-600 dark:text-gray-400"
              }
            >
              ${account.currentBalance.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {account.currentBalance > 0 ? "Positive Balance" : account.currentBalance < 0 ? "Negative Balance" : "Zero Balance"}
          </p>
        </CardContent>
      </Card>

      {/* Payment Statistics Cards */}
      {paymentStats && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
            Payment Statistics (Current Month)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Cash Flow Card */}
            <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Cash Flow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Inflow:</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      ${paymentStats.cash.inflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Outflow:</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      ${paymentStats.cash.outflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-gray-800 dark:text-white">Net:</span>
                      <span className={`text-sm font-bold ${
                        paymentStats.cash.net > 0
                          ? "text-green-600 dark:text-green-400"
                          : paymentStats.cash.net < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}>
                        ${paymentStats.cash.net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bank Flow Card */}
            <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center">
                  <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                  Bank Flow
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Inflow:</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      ${paymentStats.bank.inflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Outflow:</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      ${paymentStats.bank.outflow.toLocaleString()}
                    </span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-bold text-gray-800 dark:text-white">Net:</span>
                      <span className={`text-sm font-bold ${
                        paymentStats.bank.net > 0
                          ? "text-green-600 dark:text-green-400"
                          : paymentStats.bank.net < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400"
                      }`}>
                        ${paymentStats.bank.net.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>

          {/* Total Summary Card */}
          <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-center text-gray-800 dark:text-white">
                Total Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    ${paymentStats.total.inflow.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Inflow</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                    ${paymentStats.total.outflow.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Outflow</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold mb-1 ${
                    paymentStats.total.net > 0
                      ? "text-green-600 dark:text-green-400"
                      : paymentStats.total.net < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                  }`}>
                    ${paymentStats.total.net.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Net Flow</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Transaction Button */}
      <div className="mb-6">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Add Transaction Form */}
      {showAddForm && (
        <Card className="mb-6 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
              Add Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="type" className="font-bold">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDIT">Credit</SelectItem>
                      <SelectItem value="DEBIT">Debit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="amount" className="font-bold">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description" className="font-bold">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="reference" className="font-bold">Reference (Optional)</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                  Add Transaction
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No transactions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto">
                <thead>
                  <tr className="text-sm text-gray-500 dark:text-gray-300 border-b">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-left">Amount</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-left">Reference</th>
                    <th className="px-4 py-2 text-left">Balance</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700 dark:text-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            transaction.type === "CREDIT"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          }`}
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        ${transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">{transaction.description}</td>
                      <td className="px-4 py-3">{transaction.reference || "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            transaction.newBalance > 0
                              ? "text-green-600 dark:text-green-400"
                              : transaction.newBalance < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-600 dark:text-gray-400"
                          }
                        >
                          ${transaction.newBalance.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
