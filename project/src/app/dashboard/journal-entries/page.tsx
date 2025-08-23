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
  Eye, 
  CheckCircle, 
  ArrowLeft,
  FileText,
  Table,
  Printer,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ChartOfAccount {
  id: number;
  code: string;
  accountName: string;
  category: string;
  type: string;
}

interface JournalEntryLine {
  id: number;
  accountId: number;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  reference?: string;
  account: ChartOfAccount;
}

interface JournalEntry {
  id: number;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  postedAt?: string;
  lines: JournalEntryLine[];
}

const JournalEntriesPage = () => {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [isPostedFilter, setIsPostedFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(50);

  // Dialog states
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: "",
    reference: "",
    lines: [
      { accountId: 0, debitAmount: 0, creditAmount: 0, description: "" },
      { accountId: 0, debitAmount: 0, creditAmount: 0, description: "" }
    ]
  });

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(searchTerm && { search: searchTerm }),
        ...(fromDate && { fromDate }),
        ...(toDate && { toDate }),
        ...(isPostedFilter && isPostedFilter !== "all" && { isPosted: isPostedFilter })
      });

      const response = await fetch(`/api/journal-entries?${params}`);
      const data = await response.json();

      if (data.success) {
        setEntries(data.data);
        setTotal(data.total);
      } else {
        toast.error("Failed to fetch journal entries");
      }
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      toast.error("Failed to fetch journal entries");
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setAccountsLoading(true);
      const response = await fetch("/api/chart-of-accounts?limit=1000");
      const data = await response.json();

      if (data.success && data.data) {
        setAccounts(data.data);
      } else {
        console.error("Failed to load accounts:", data);
        setAccounts([]);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const createEntry = async () => {
    try {
      // Validate form
      if (!formData.description || formData.lines.length < 2) {
        toast.error("Description and at least 2 lines are required");
        return;
      }

      // Validate that all lines have accounts
      if (formData.lines.some(line => line.accountId === 0)) {
        toast.error("All lines must have accounts selected");
        return;
      }

      // Validate double-entry bookkeeping
      const totalDebit = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
      const totalCredit = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        toast.error("Total debits must equal total credits");
        return;
      }

      const response = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Journal entry created successfully");
        setIsAddDialogOpen(false);
        setFormData({
          date: new Date().toISOString().split('T')[0],
          description: "",
          reference: "",
          lines: [
            { accountId: 0, debitAmount: 0, creditAmount: 0, description: "" },
            { accountId: 0, debitAmount: 0, creditAmount: 0, description: "" }
          ]
        });
        fetchEntries();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error creating journal entry:", error);
      toast.error("Failed to create journal entry");
    }
  };

  const postEntry = async (entryId: number) => {
    try {
      const response = await fetch("/api/journal-entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", entryId })
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Journal entry posted successfully");
        fetchEntries();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      console.error("Error posting journal entry:", error);
      toast.error("Failed to post journal entry");
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { accountId: 0, debitAmount: 0, creditAmount: 0, description: "" }]
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 2) {
      const newLines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines: newLines });
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const viewEntry = (entry: JournalEntry) => {
    setViewingEntry(entry);
    setIsViewDialogOpen(true);
  };

  const exportToExcel = () => {
    toast.info("Excel export functionality coming soon");
  };

  const exportToPDF = () => {
    toast.info("PDF export functionality coming soon");
  };

  const exportToPrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, [page, searchTerm, fromDate, toDate, isPostedFilter, limit]);

  const totalDebit = formData.lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  const totalCredit = formData.lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0"
    >
      {/* Header */}
      <div className="mb-4 sm:mb-8">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Journal Entries
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your company's journal entries
            </p>
          </div>
          
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 sm:mb-6">
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="flex w-full max-w-sm">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder="From Date"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder="To Date"
              />
            </div>

            {/* Posted Filter */}
            <Select value={isPostedFilter} onValueChange={setIsPostedFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Posted</SelectItem>
                <SelectItem value="false">Draft</SelectItem>
              </SelectContent>
            </Select>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
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

      {/* Journal Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Journal Entries ({total} entries)</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-2 sm:border-spacing-y-4">
                <thead>
                  <tr className="border-b text-xs sm:text-sm">
                    <th className="text-left p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Entry #</span>
                      <span className="sm:hidden">Entry</span>
                    </th>
                    <th className="text-left p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Date</span>
                      <span className="sm:hidden">Date</span>
                    </th>
                    <th className="text-left p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Description</span>
                      <span className="sm:hidden">Desc</span>
                    </th>
                    <th className="text-left p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Reference</span>
                      <span className="sm:hidden">Ref</span>
                    </th>
                    <th className="text-right p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Total Debit</span>
                      <span className="sm:hidden">Debit</span>
                    </th>
                    <th className="text-right p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Total Credit</span>
                      <span className="sm:hidden">Credit</span>
                    </th>
                    <th className="text-left p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Status</span>
                      <span className="sm:hidden">Status</span>
                    </th>
                    <th className="text-right p-2 sm:p-3 font-medium">
                      <span className="hidden sm:inline">Actions</span>
                      <span className="sm:hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {entries && entries.length > 0 ? (
                    entries.map((entry) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="p-2 sm:p-3 font-mono">{entry.entryNumber}</td>
                        <td className="p-2 sm:p-3">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="p-2 sm:p-3">
                          <span className="hidden sm:inline">{entry.description}</span>
                          <span className="sm:hidden">{entry.description?.substring(0, 20)}...</span>
                        </td>
                        <td className="p-2 sm:p-3">
                          <span className="hidden sm:inline">{entry.reference || "-"}</span>
                          <span className="sm:hidden">{entry.reference?.substring(0, 8) || "-"}...</span>
                        </td>
                        <td className="p-2 sm:p-3 text-right">${entry.totalDebit.toFixed(2)}</td>
                        <td className="p-2 sm:p-3 text-right">${entry.totalCredit.toFixed(2)}</td>
                        <td className="p-2 sm:p-3">
                          <span className={`px-1 sm:px-2 py-1 rounded-full text-xs ${
                            entry.isPosted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                          }`}>
                            <span className="hidden sm:inline">{entry.isPosted ? "Posted" : "Draft"}</span>
                            <span className="sm:hidden">{entry.isPosted ? "Posted" : "Draft"}</span>
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => viewEntry(entry)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View
                              </DropdownMenuItem>
                              {!entry.isPosted && (
                                <DropdownMenuItem onClick={() => postEntry(entry.id)}>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Post Entry
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-500">
                        No journal entries found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 mt-4 sm:mt-6">
              <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="w-full sm:w-auto"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / limit)}
                  className="w-full sm:w-auto"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Journal Entry Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-full">
          <DialogHeader>
            <DialogTitle>Create New Journal Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-6">
            {/* Header Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Optional reference"
              />
            </div>

            {/* Journal Entry Lines */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-4">
                <Label>Journal Entry Lines</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line
                </Button>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                {formData.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-end border p-3 sm:p-4 rounded-lg">
                    <div className="sm:col-span-4">
                      <Label>Account</Label>
                      <Select 
                        value={String(line.accountId)} 
                        onValueChange={(value) => updateLine(index, "accountId", parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accountsLoading ? (
                            <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
                          ) : accounts && accounts.length > 0 ? (
                            accounts.map((account) => (
                              <SelectItem key={account.id} value={String(account.id)}>
                                {account.code} - {account.accountName}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-accounts" disabled>No accounts available</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Debit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debitAmount || ""}
                        onChange={(e) => updateLine(index, "debitAmount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Credit</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.creditAmount || ""}
                        onChange={(e) => updateLine(index, "creditAmount", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <Label>Description</Label>
                      <Input
                        value={line.description || ""}
                        onChange={(e) => updateLine(index, "description", e.target.value)}
                        placeholder="Line description"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      {formData.lines.length > 2 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeLine(index)}
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <div>
                    <span className="text-xs sm:text-sm text-gray-600">Total Debit:</span>
                    <span className="ml-2 font-semibold">${totalDebit.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm text-gray-600">Total Credit:</span>
                    <span className="ml-2 font-semibold">${totalCredit.toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isBalanced && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-xs sm:text-sm ${isBalanced ? "text-green-600" : "text-red-600"}`}>
                    {isBalanced ? "Balanced" : "Not Balanced"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createEntry} disabled={!isBalanced}>
                Create Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Journal Entry Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
          </DialogHeader>
          {viewingEntry && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <Label>Entry Number</Label>
                  <p className="font-mono">{viewingEntry.entryNumber}</p>
                </div>
                <div>
                  <Label>Date</Label>
                  <p>{new Date(viewingEntry.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <span className={`px-1 sm:px-2 py-1 rounded-full text-xs ${
                    viewingEntry.isPosted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {viewingEntry.isPosted ? "Posted" : "Draft"}
                  </span>
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <p>{viewingEntry.description}</p>
              </div>
              {viewingEntry.reference && (
                <div>
                  <Label>Reference</Label>
                  <p>{viewingEntry.reference}</p>
                </div>
              )}

              {/* Journal Entry Lines */}
              <div>
                <Label>Journal Entry Lines</Label>
                <div className="mt-4 space-y-2">
                  {viewingEntry.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center border p-3 rounded">
                      <div className="sm:col-span-4">
                        <span className="text-xs sm:text-sm text-gray-600">{line.account.code} - {line.account.accountName}</span>
                      </div>
                      <div className="sm:col-span-2 text-right">
                        <span className="font-mono">${line.debitAmount.toFixed(2)}</span>
                      </div>
                      <div className="sm:col-span-2 text-right">
                        <span className="font-mono">${line.creditAmount.toFixed(2)}</span>
                      </div>
                      <div className="sm:col-span-4">
                        <span className="text-xs sm:text-sm">{line.description || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                    <div>
                      <span className="text-xs sm:text-sm text-gray-600">Total Debit:</span>
                      <span className="ml-2 font-semibold">${viewingEntry.totalDebit.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm text-gray-600">Total Credit:</span>
                      <span className="ml-2 font-semibold">${viewingEntry.totalCredit.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-green-600">
                    <span className="text-xs sm:text-sm">Balanced</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default JournalEntriesPage;
