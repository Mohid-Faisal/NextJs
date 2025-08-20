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
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Plus, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  ArrowLeft,
  FileText,
  Table,
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ChartOfAccount {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
  debitRule: string;
  creditRule: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const ChartOfAccountsPage = () => {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);
  const [isInitialized, setIsInitialized] = useState(false);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    code: "",
    accountName: "",
    category: "",
    type: "",
    debitRule: "",
    creditRule: "",
    description: ""
  });

  const categories = ["Asset", "Liability", "Equity", "Expense", "Revenue"];
  const types = {
    Asset: ["Current Asset", "Fixed Asset", "Prepayment"],
    Liability: ["Current Liability", "Non-Current Liability"],
    Equity: ["Equity"],
    Expense: ["Direct Costs", "Overhead", "Depreciation"],
    Revenue: ["Revenue"]
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm && { search: searchTerm }),
        ...(categoryFilter && categoryFilter !== "all" && { category: categoryFilter }),
        ...(typeFilter && typeFilter !== "all" && { type: typeFilter })
      });

      const response = await fetch(`/api/chart-of-accounts?${params}`);
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data);
        setTotal(data.total);
      } else {
        toast.error("Failed to fetch accounts");
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      toast.error("Failed to fetch accounts");
    } finally {
      setLoading(false);
    }
  };

  const initializeAccounts = async () => {
    try {
      const response = await fetch("/api/chart-of-accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "initialize" })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setIsInitialized(true);
        fetchAccounts();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error initializing accounts:", error);
      toast.error("Failed to initialize accounts");
    }
  };

  const createAccount = async () => {
    try {
      const response = await fetch("/api/chart-of-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Account created successfully");
        setIsAddDialogOpen(false);
        setFormData({
          code: "",
          accountName: "",
          category: "",
          type: "",
          debitRule: "",
          creditRule: "",
          description: ""
        });
        fetchAccounts();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Failed to create account");
    }
  };

  const updateAccount = async () => {
    if (!editingAccount) return;

    try {
      const response = await fetch(`/api/chart-of-accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Account updated successfully");
        setIsEditDialogOpen(false);
        setEditingAccount(null);
        setFormData({
          code: "",
          accountName: "",
          category: "",
          type: "",
          debitRule: "",
          creditRule: "",
          description: ""
        });
        fetchAccounts();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error updating account:", error);
      toast.error("Failed to update account");
    }
  };

  const deleteAccount = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account?")) return;

    try {
      const response = await fetch(`/api/chart-of-accounts/${id}`, {
        method: "DELETE"
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Account deleted successfully");
        fetchAccounts();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account");
    }
  };

  const openEditDialog = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      accountName: account.accountName,
      category: account.category,
      type: account.type,
      debitRule: account.debitRule,
      creditRule: account.creditRule,
      description: account.description || ""
    });
    setIsEditDialogOpen(true);
  };

  const exportToExcel = () => {
    // Implementation for Excel export
    toast.info("Excel export functionality coming soon");
  };

  const exportToPDF = () => {
    // Implementation for PDF export
    toast.info("PDF export functionality coming soon");
  };

  const exportToPrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchAccounts();
  }, [page, searchTerm, categoryFilter, typeFilter, limit]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto px-4 py-8"
    >
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Chart of Accounts
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your company's chart of accounts
            </p>
          </div>
          
          <div className="flex gap-2">
            {!isInitialized && (
              <Button onClick={initializeAccounts} variant="outline">
                Initialize Default Accounts
              </Button>
            )}
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {categoryFilter && types[categoryFilter as keyof typeof types]?.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportToExcel}>
                  <Table className="w-4 h-4 mr-2" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF}>
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chart of Accounts ({total} accounts)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Code</th>
                    <th className="text-left p-3 font-medium">Account Name</th>
                    <th className="text-left p-3 font-medium">Category</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Debit Rule</th>
                    <th className="text-left p-3 font-medium">Credit Rule</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3 font-mono">{account.code}</td>
                      <td className="p-3">{account.accountName}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          account.category === "Asset" ? "bg-blue-100 text-blue-800" :
                          account.category === "Liability" ? "bg-red-100 text-red-800" :
                          account.category === "Equity" ? "bg-green-100 text-green-800" :
                          account.category === "Expense" ? "bg-orange-100 text-orange-800" :
                          "bg-purple-100 text-purple-800"
                        }`}>
                          {account.category}
                        </span>
                      </td>
                      <td className="p-3 text-sm">{account.type}</td>
                      <td className="p-3 text-sm">{account.debitRule}</td>
                      <td className="p-3 text-sm">{account.creditRule}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          account.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {account.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(account)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteAccount(account.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} accounts
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="code">Account Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., 1101"
              />
            </div>
            <div>
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g., Cash"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value, type: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {formData.category && types[formData.category as keyof typeof types]?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="debitRule">Debit Rule</Label>
              <Select value={formData.debitRule} onValueChange={(value) => setFormData({ ...formData, debitRule: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select debit rule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Increases">Increases</SelectItem>
                  <SelectItem value="Decreases">Decreases</SelectItem>
                  <SelectItem value="No Rule">No Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="creditRule">Credit Rule</Label>
              <Select value={formData.creditRule} onValueChange={(value) => setFormData({ ...formData, creditRule: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credit rule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Increases">Increases</SelectItem>
                  <SelectItem value="Decreases">Decreases</SelectItem>
                  <SelectItem value="No Rule">No Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createAccount}>
                Create Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-code">Account Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., 1101"
              />
            </div>
            <div>
              <Label htmlFor="edit-accountName">Account Name</Label>
              <Input
                id="edit-accountName"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                placeholder="e.g., Cash"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value, type: "" })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {formData.category && types[formData.category as keyof typeof types]?.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-debitRule">Debit Rule</Label>
              <Select value={formData.debitRule} onValueChange={(value) => setFormData({ ...formData, debitRule: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select debit rule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Increases">Increases</SelectItem>
                  <SelectItem value="Decreases">Decreases</SelectItem>
                  <SelectItem value="No Rule">No Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-creditRule">Credit Rule</Label>
              <Select value={formData.creditRule} onValueChange={(value) => setFormData({ ...formData, creditRule: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select credit rule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Increases">Increases</SelectItem>
                  <SelectItem value="Decreases">Decreases</SelectItem>
                  <SelectItem value="No Rule">No Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateAccount}>
                Update Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default ChartOfAccountsPage;
