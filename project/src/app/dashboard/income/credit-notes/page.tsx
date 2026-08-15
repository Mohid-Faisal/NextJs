"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Printer,
  FileText,
  Trash2,
  MoreVertical,
  Pencil,
  Search,
  Upload,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CreateCreditNoteDialog from "@/components/CreateCreditNoteDialog";
import { TablePagination } from "@/components/TablePagination";
import { TableViewOptions, type ColumnOption } from "@/components/TableViewOptions";

const creditNoteColumns: ColumnOption[] = [
  { id: "creditNoteNumber", label: "Adjustment #" },
  { id: "type", label: "Type" },
  { id: "customer", label: "Customer" },
  { id: "invoice", label: "Invoice #" },
  { id: "date", label: "Date" },
  { id: "amount", label: "Amount" },
  { id: "description", label: "Description" },
  { id: "actions", label: "Actions" },
];

type CreditNote = {
  id: number;
  creditNoteNumber: string;
  invoiceId?: number;
  invoice?: {
    id: number;
    invoiceNumber: string;
    totalAmount: number;
  };
  customerId?: number;
  customer?: {
    id: number;
    PersonName: string;
    CompanyName: string;
  };
  amount: number;
  date: string;
  description?: string;
  currency: string;
  createdAt: string;
  type?: "DEBIT" | "CREDIT";
};

type SortField = keyof CreditNote;
type SortOrder = "asc" | "desc";

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    creditNoteNumber: true,
    type: true,
    customer: true,
    invoice: true,
    date: true,
    amount: true,
    description: true,
    actions: true,
  });

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [refreshing, setRefreshing] = useState(false);

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [editNoteId, setEditNoteId] = useState<number | null>(null);

  const fetchCreditNotes = async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(searchTerm && { search: searchTerm }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/credit-notes?${params.toString()}`);
      const json = await res.json();
      
      setCreditNotes(json.creditNotes || []);
      setTotal(json.total || 0);
      setTotalAmount(json.totalAmount ?? 0);
    } catch (err) {
      console.error("Error fetching credit notes:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCreditNotes();
  };

  useEffect(() => {
    fetchCreditNotes();
  }, [page, pageSize, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };



  const exportToCSV = () => {
    const headers = [
      "ID",
      "Adjustment #",
      "Type",
      "Customer",
      "Invoice #",
      "Date",
      "Amount",
      "Description",
    ];
    const rows = creditNotes?.map((cn) => [
      cn.id,
      cn.creditNoteNumber,
      cn.type || (cn.description?.toLowerCase().startsWith("debit note") ? "DEBIT" : "CREDIT"),
      cn.customer?.PersonName || cn.customer?.CompanyName || "-",
      cn.invoice?.invoiceNumber || "-",
      new Date(cn.date).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }),
      `${cn.currency} ${cn.amount.toLocaleString()}`,
      cn.description || "-",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `adjustments_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = creditNotes
      ?.map(
        (cn) => `
          <tr>
            <td>${cn.id}</td>
            <td>${cn.creditNoteNumber}</td>
            <td>${cn.type || (cn.description?.toLowerCase().startsWith("debit note") ? "DEBIT" : "CREDIT")}</td>
            <td>${cn.customer?.PersonName || cn.customer?.CompanyName || "-"}</td>
            <td>${cn.invoice?.invoiceNumber || "-"}</td>
            <td>${new Date(cn.date).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}</td>
            <td>${cn.currency} ${cn.amount.toLocaleString()}</td>
            <td>${cn.description || "-"}</td>
          </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Adjustments</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Adjustments</h1>
          <p>Total Amount: ${totalAmount.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Adjustment #</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <FileText className="w-8 sm:w-10 h-8 sm:h-10 text-green-600" />
            Manage Adjustments
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Compensate for overpayment from customers
          </p>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 flex-wrap">
          <div className="px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center min-w-[100px] bg-white dark:bg-gray-900 text-gray-850 dark:text-gray-200 shadow-sm border border-gray-150/40">
            <span className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-300">
              {total}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Total Records
            </span>
          </div>
          <div className="px-4 py-2 text-xs sm:text-sm font-medium rounded-md flex flex-col items-center justify-center min-w-[120px] bg-white dark:bg-gray-900 text-gray-850 dark:text-gray-200 shadow-sm border border-gray-150/40">
            <span className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-300">
              {Math.round(totalAmount).toLocaleString()}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Total Amount
            </span>
          </div>
        </div>
      </div>

      {/* Filters and Actions Toolbar */}
      <div className="mb-4 sm:mb-6 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5">
        {/* Left side - Search bar */}
        <div className="relative w-full xl:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="pl-9 h-9 text-xs sm:text-sm rounded-lg"
          />
        </div>

        {/* Right side - Action buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 overflow-x-auto pb-1 xl:pb-0 shrink-0">
          {/* Refresh Button */}
          <Button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="w-9 h-9 p-0 justify-center bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 shrink-0 flex items-center rounded-lg shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 px-3 justify-center bg-white text-gray-800 hover:bg-gray-100 border border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 text-xs font-semibold shrink-0 flex items-center gap-1.5 rounded-lg shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[110px]">
              <DropdownMenuItem onClick={exportToCSV} className="flex items-center gap-2 text-xs">
                <Table className="w-3.5 h-3.5" />
                CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPrint} className="flex items-center gap-2 text-xs">
                <Printer className="w-3.5 h-3.5" />
                Print
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Column Selector */}
          <TableViewOptions
            columns={creditNoteColumns}
            visibleColumns={visibleColumns}
            onToggleColumn={toggleColumn}
          />

          <Button
            onClick={() => {
              setEditNoteId(null);
              setOpenCreateDialog(true);
            }}
            size="sm"
            className="h-9 bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-1.5 text-xs font-semibold px-3 rounded-lg shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> <span>Add New</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {!creditNotes || creditNotes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No adjustments found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  {visibleColumns.creditNoteNumber !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("creditNoteNumber")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <span className="hidden sm:inline">ADJUSTMENT</span>
                        <span className="sm:hidden">ADJ</span>
                        {getSortIcon("creditNoteNumber")}
                      </button>
                    </th>
                  )}
                  {visibleColumns.type !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <span className="hidden sm:inline">TYPE</span>
                      <span className="sm:hidden">TYPE</span>
                    </th>
                  )}
                  {visibleColumns.customer !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("customer")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <span className="hidden sm:inline">CUSTOMER</span>
                        <span className="sm:hidden">CUSTOMER</span>
                        {getSortIcon("customer")}
                      </button>
                    </th>
                  )}
                  {visibleColumns.invoice !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <span className="hidden sm:inline">INVOICE #</span>
                      <span className="sm:hidden">INVOICE</span>
                    </th>
                  )}
                  {visibleColumns.date !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("date")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <span className="hidden sm:inline">DATE</span>
                        <span className="sm:hidden">DATE</span>
                        {getSortIcon("date")}
                      </button>
                    </th>
                  )}
                  {visibleColumns.amount !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <button
                        onClick={() => handleSort("amount")}
                        className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <span className="hidden sm:inline">AMOUNT</span>
                        <span className="sm:hidden">AMOUNT</span>
                        {getSortIcon("amount")}
                      </button>
                    </th>
                  )}
                  {visibleColumns.description !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <span className="hidden sm:inline">DESCRIPTION</span>
                      <span className="sm:hidden">DESC</span>
                    </th>
                  )}
                  {visibleColumns.actions !== false && (
                    <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                      <span className="hidden sm:inline">ACTIONS</span>
                      <span className="sm:hidden">ACT</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                {creditNotes.map((cn) => (
                  <tr
                    key={cn.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    {visibleColumns.creditNoteNumber !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="bg-green-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-medium">
                          <span className="hidden sm:inline">{cn.creditNoteNumber}</span>
                          <span className="sm:hidden">{cn.creditNoteNumber?.substring(0, 8)}...</span>
                        </span>
                      </td>
                    )}
                    {visibleColumns.type !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${cn.type === "DEBIT" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"}`}>
                          {cn.type || (cn.description?.toLowerCase().startsWith("debit note") ? "DEBIT" : "CREDIT")}
                        </span>
                      </td>
                    )}
                    {visibleColumns.customer !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{cn.customer?.PersonName || cn.customer?.CompanyName || "-"}</span>
                        <span className="sm:hidden">{cn.customer?.PersonName?.substring(0, 10) || cn.customer?.CompanyName?.substring(0, 10) || "-"}...</span>
                      </td>
                    )}
                    {visibleColumns.invoice !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {cn.invoice?.invoiceNumber ? (
                          <span className="bg-blue-100 text-blue-800 px-1 sm:px-2 py-1 rounded text-xs font-medium">
                            <span className="hidden sm:inline">{cn.invoice.invoiceNumber}</span>
                            <span className="sm:hidden">{cn.invoice.invoiceNumber?.substring(0, 8)}...</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">No Invoice</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.date !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        {new Date(cn.date).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                    )}
                    {visibleColumns.amount !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">
                        {cn.currency} {cn.amount.toLocaleString()}
                      </td>
                    )}
                    {visibleColumns.description !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <span className="hidden sm:inline">{cn.description || `${cn.creditNoteNumber} Adjustment`}</span>
                        <span className="sm:hidden">{cn.description?.substring(0, 15) || `${cn.creditNoteNumber} Adjustment`.substring(0, 15)}...</span>
                      </td>
                    )}
                    {visibleColumns.actions !== false && (
                      <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditNoteId(cn.id);
                                setOpenCreateDialog(true);
                              }}
                            >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              if (confirm("Are you sure you want to delete this adjustment? This action cannot be undone.")) {
                                try {
                                  const res = await fetch(`/api/credit-notes/${cn.id}`, {
                                    method: "DELETE",
                                  });
                                  if (res.ok) {
                                    toast.success("Adjustment deleted successfully");
                                    // Refresh the data
                                    const params = new URLSearchParams({
                                      page: String(page),
                                      limit: pageSize === "all" ? "all" : String(pageSize),
                                      ...(searchTerm && { search: searchTerm }),
                                      sortField: sortField,
                                      sortOrder: sortOrder,
                                    });
                                    const fetchRes = await fetch(`/api/credit-notes?${params.toString()}`);
                                    const json = await fetchRes.json();
                                    setCreditNotes(json.creditNotes);
                                    setTotal(json.total);
                                  } else {
                                    const error = await res.json();
                                    toast.error(error.error || "Failed to delete adjustment");
                                  }
                                } catch (error) {
                                  console.error("Error deleting adjustment:", error);
                                  toast.error("Failed to delete adjustment");
                                }
                              }
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <TablePagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        entityName="adjustments"
      />

      {/* Create Adjustment Dialog */}
      <Dialog
        open={openCreateDialog}
        onOpenChange={(open) => {
          setOpenCreateDialog(open);
          if (!open) setEditNoteId(null);
        }}
      >
        <DialogContent className="max-w-md w-full">
          <CreateCreditNoteDialog
            key={editNoteId ?? "new"}
            editId={editNoteId}
            onClose={() => {
              setOpenCreateDialog(false);
              setEditNoteId(null);
            }}
            onSuccess={() => {
              setOpenCreateDialog(false);
              setEditNoteId(null);
              // Refresh the data
              const params = new URLSearchParams({
                page: String(page),
                limit: pageSize === "all" ? "all" : String(pageSize),
                ...(searchTerm && { search: searchTerm }),
                sortField: sortField,
                sortOrder: sortOrder,
              });
              fetch(`/api/credit-notes?${params.toString()}`)
                .then(res => res.json())
                .then(json => {
                  setCreditNotes(json.creditNotes);
                  setTotal(json.total);
                });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
