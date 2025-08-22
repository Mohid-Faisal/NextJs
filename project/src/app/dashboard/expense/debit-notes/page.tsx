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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import CreateDebitNoteDialog from "@/components/CreateDebitNoteDialog";

type DebitNote = {
  id: number;
  debitNoteNumber: string;
  billId?: number;
  bill?: {
    id: number;
    invoiceNumber: string;
    totalAmount: number;
  };
  vendorId?: number;
  vendor?: {
    id: number;
    PersonName: string;
    CompanyName: string;
  };
  amount: number;
  date: string;
  description?: string;
  currency: string;
  createdAt: string;
};

type SortField = keyof DebitNote;
type SortOrder = "asc" | "desc";

export default function DebitNotesPage() {
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
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
    const fetchDebitNotes = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(searchTerm && { search: searchTerm }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/debit-notes?${params.toString()}`);
      const json = await res.json();
      
      setDebitNotes(json.debitNotes);
      setTotal(json.total);
    };

    fetchDebitNotes();
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

  const totalAmount = debitNotes?.reduce((acc, dn) => acc + dn.amount, 0) || 0;

  const exportToCSV = () => {
         const headers = [
       "ID",
       "Debit Note #",
       "Vendor",
       "Bill/Invoice #",
       "Date",
       "Amount",
       "Description",
     ];
         const rows = debitNotes?.map((dn) => [
      dn.id,
      dn.debitNoteNumber,
      dn.vendor?.PersonName || dn.vendor?.CompanyName || "-",
      dn.bill?.invoiceNumber || "-",
      new Date(dn.date).toLocaleDateString(),
      `${dn.currency} ${dn.amount.toLocaleString()}`,
      dn.description || "-",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `debit_notes_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
         const rows = debitNotes
       ?.map(
        (dn) => `
                 <tr>
           <td>${dn.id}</td>
           <td>${dn.debitNoteNumber}</td>
           <td>${dn.vendor?.PersonName || dn.vendor?.CompanyName || "-"}</td>
           <td>${dn.bill?.invoiceNumber || "-"}</td>
           <td>${new Date(dn.date).toLocaleDateString()}</td>
           <td>${dn.currency} ${dn.amount.toLocaleString()}</td>
           <td>${dn.description || "-"}</td>
         </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Debit Notes</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Debit Notes</h1>
          <p>Total Amount: ${totalAmount.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                                 <th>ID</th>
                 <th>Debit Note #</th>
                 <th>Vendor</th>
                 <th>Bill/Invoice #</th>
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
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <FileText className="w-10 h-10 text-orange-600" />
            Manage Debit Notes
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Compensate for less payment to vendors
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Total Records
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 w-full max-w-xl">
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

          <div className="flex w-full">
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            <div className="bg-orange-500 px-3 flex items-center justify-center rounded-r-md text-white text-sm">
              Search
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2">
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
        <CardContent className="p-6 overflow-x-auto">
                     {!debitNotes || debitNotes.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No debit notes found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("debitNoteNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      DEBIT NOTE {getSortIcon("debitNoteNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("vendor")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      VENDOR {getSortIcon("vendor")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">BILL/INVOICE</th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("date")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      DATE {getSortIcon("date")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("amount")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      AMOUNT {getSortIcon("amount")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">DESCRIPTION</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                {debitNotes.map((dn) => (
                  <tr
                    key={dn.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <td className="px-4 py-3">
                      <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        {dn.debitNoteNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {dn.vendor?.PersonName || dn.vendor?.CompanyName || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {dn.bill?.invoiceNumber ? (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {dn.bill.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">No Bill</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(dn.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {dn.currency} {dn.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {dn.description || `${dn.debitNoteNumber} Debit Note`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((prev) => prev - 1)}
            className="hover:scale-105 transition-transform"
          >
            ← Prev
          </Button>
          <span>
            Page {page} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => prev + 1)}
            className="hover:scale-105 transition-transform"
          >
            Next →
          </Button>
        </div>
      )}



      {/* Create Debit Note Dialog */}
      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="max-w-md w-full">
          <CreateDebitNoteDialog
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
              fetch(`/api/debit-notes?${params.toString()}`)
                .then(res => res.json())
                .then(json => {
                  setDebitNotes(json.debitNotes);
                  setTotal(json.total);
                });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
