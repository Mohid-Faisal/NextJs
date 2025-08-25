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
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import CreateCreditNoteDialog from "@/components/CreateCreditNoteDialog";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  useEffect(() => {
    const fetchCreditNotes = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(searchTerm && { search: searchTerm }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/credit-notes?${params.toString()}`);
      const json = await res.json();
      
      setCreditNotes(json.creditNotes);
      setTotal(json.total);
    };

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

  const totalAmount = creditNotes?.reduce((acc, cn) => acc + cn.amount, 0) || 0;

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Credit Note #",
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
      new Date(cn.date).toLocaleDateString(),
      `${cn.currency} ${cn.amount.toLocaleString()}`,
      cn.description || "-",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `credit_notes_${new Date().toISOString().split("T")[0]}.csv`;
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
            <td>${new Date(cn.date).toLocaleDateString()}</td>
            <td>${cn.currency} ${cn.amount.toLocaleString()}</td>
            <td>${cn.description || "-"}</td>
          </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Credit Notes</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Credit Notes</h1>
          <p>Total Amount: ${totalAmount.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Credit Note #</th>
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
            Manage Credit Notes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Compensate for overpayment from customers
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
            {total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Records
          </div>
        </div>
      </div>

      <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        {/* Left side - Page size and Search bar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end w-full lg:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Show:</span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(value === "all" ? "all" : parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-24 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full max-w-sm">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            <div className="bg-green-500 px-3 flex items-center justify-center rounded-r-md text-white text-sm">
              Search
            </div>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 sm:gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setOpenCreateDialog(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add New
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              className="flex items-center gap-2"
            >
              <Table className="w-4 h-4" /> CSV
            </Button>
            <Button
              variant="outline"
              onClick={exportToPrint}
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" /> Print
            </Button>
          </div>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-3 sm:p-4 lg:p-6 overflow-x-auto">
          {!creditNotes || creditNotes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No credit notes found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-2 sm:border-spacing-y-4">
              <thead>
                <tr className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("creditNoteNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      <span className="hidden sm:inline">CREDIT NOTE</span>
                      <span className="sm:hidden">CREDIT</span>
                      {getSortIcon("creditNoteNumber")}
                    </button>
                  </th>
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">TYPE</span>
                    <span className="sm:hidden">TYPE</span>
                  </th>
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
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">INVOICE #</span>
                    <span className="sm:hidden">INVOICE</span>
                  </th>
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
                  <th className="px-2 sm:px-3 lg:px-4 py-2 text-left">
                    <span className="hidden sm:inline">DESCRIPTION</span>
                    <span className="sm:hidden">DESC</span>
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 font-light">
                {creditNotes.map((cn) => (
                  <tr
                    key={cn.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="bg-green-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-medium">
                        <span className="hidden sm:inline">{cn.creditNoteNumber}</span>
                        <span className="sm:hidden">{cn.creditNoteNumber?.substring(0, 8)}...</span>
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${cn.type === "DEBIT" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"}`}>
                        {cn.type || (cn.description?.toLowerCase().startsWith("debit note") ? "DEBIT" : "CREDIT")}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{cn.customer?.PersonName || cn.customer?.CompanyName || "-"}</span>
                      <span className="sm:hidden">{cn.customer?.PersonName?.substring(0, 10) || cn.customer?.CompanyName?.substring(0, 10) || "-"}...</span>
                    </td>
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
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      {new Date(cn.date).toLocaleDateString()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3 font-medium">
                      {cn.currency} {cn.amount.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-3 lg:px-4 py-2 sm:py-3">
                      <span className="hidden sm:inline">{cn.description || `${cn.creditNoteNumber} Credit Note`}</span>
                      <span className="sm:hidden">{cn.description?.substring(0, 15) || `${cn.creditNoteNumber} Credit Note`.substring(0, 15)}...</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 text-sm text-gray-600 dark:text-gray-300">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="hover:scale-105 transition-transform w-full sm:w-auto"
          >
            ← Prev
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="hover:scale-105 transition-transform w-full sm:w-auto"
          >
            Next →
          </Button>
        </div>
      )}

      {/* Create Credit Note Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="max-w-md w-full">
          <CreateCreditNoteDialog
            onClose={() => setOpenCreateDialog(false)}
            onSuccess={() => {
              setOpenCreateDialog(false);
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
