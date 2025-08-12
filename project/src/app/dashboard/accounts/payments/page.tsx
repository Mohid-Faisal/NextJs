"use client";

import { useEffect, useMemo, useState } from "react";
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
import Link from "next/link";
import { Table, Plus, Edit, Trash2 } from "lucide-react";
import { ArrowDown, ArrowUp, ArrowUpDown, Printer } from "lucide-react";
import { toast } from "sonner";
import DeleteDialog from "@/components/DeleteDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Payment = {
  id: number;
  transactionType: "Income" | "Expense" | "Transfer";
  category: string;
  date: string; // ISO
  currency: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  mode: "Cash" | "Bank Transfer" | "Card" | "Cheque";
  reference?: string;
  dueDate?: string | null;
  description?: string;
};

type SortField = keyof Payment;
type SortOrder = "asc" | "desc";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [typeFilter, setTypeFilter] = useState("All");
  const [modeFilter, setModeFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(typeFilter !== "All" && { type: typeFilter }),
        ...(modeFilter !== "All" && { mode: modeFilter }),
        ...(searchTerm && { search: searchTerm }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/accounts/payments?${params.toString()}`);
      const json = await res.json();
      setPayments(json.payments);
      setTotal(json.total);
    };

    fetchPayments();
  }, [page, pageSize, typeFilter, modeFilter, searchTerm, sortField, sortOrder]);

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

  const totalAmount = useMemo(
    () => payments.reduce((acc, p) => acc + p.amount, 0),
    [payments]
  );

  const exportToCSV = () => {
    const headers = ["ID","Type","Category","Date","Currency","Amount","From","To","Mode","Reference","Due Date"];
    const rows = payments.map((p) => [
      p.id,
      p.transactionType,
      p.category,
      new Date(p.date).toLocaleDateString(),
      p.currency,
      p.amount,
      p.fromAccount,
      p.toAccount,
      p.mode,
      p.reference ?? "",
      p.dueDate ? new Date(p.dueDate).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = payments
      .map(
        (p) => `
        <tr>
          <td>${p.id}</td>
          <td>${p.transactionType}</td>
          <td>${p.category}</td>
          <td>${new Date(p.date).toLocaleDateString()}</td>
          <td>${p.currency}</td>
          <td>${p.amount}</td>
          <td>${p.fromAccount}</td>
          <td>${p.toAccount}</td>
          <td>${p.mode}</td>
          <td>${p.reference ?? ''}</td>
          <td>${p.dueDate ? new Date(p.dueDate).toLocaleDateString() : ''}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Payments</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Payments</h1>
          <p>Total Amount: ${totalAmount}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Category</th>
                <th>Date</th>
                <th>Currency</th>
                <th>Amount</th>
                <th>From</th>
                <th>To</th>
                <th>Mode</th>
                <th>Reference</th>
                <th>Due Date</th>
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

  const handleEdit = (payment: Payment) => {
    // Navigate to add payment page with edit mode and payment data
    const queryParams = new URLSearchParams({
      mode: 'edit',
      id: payment.id.toString(),
      transactionType: payment.transactionType,
      category: payment.category,
      date: payment.date,
      currency: payment.currency,
      amount: payment.amount.toString(),
      fromAccount: payment.fromAccount,
      toAccount: payment.toAccount,
      paymentMode: payment.mode, // Changed from 'mode' to 'paymentMode' to avoid conflict
      reference: payment.reference || '',
      dueDate: payment.dueDate || '',
      description: payment.description || ''
    });
    
    window.location.href = `/dashboard/accounts/payments/add?${queryParams.toString()}`;
  };

  const handleDelete = (payment: Payment) => {
    setPaymentToDelete(payment);
    setOpenDeleteDialog(true);
  };

  const handleDeleteSuccess = async () => {
    // Refresh the payments list
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === "all" ? "all" : String(pageSize),
      ...(typeFilter !== "All" && { type: typeFilter }),
      ...(modeFilter !== "All" && { mode: modeFilter }),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/accounts/payments?${params.toString()}`);
    const json = await res.json();
    setPayments(json.payments);
    setTotal(json.total);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">Payments</h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{total}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Records</div>
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
              placeholder="Search by customer or reference..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="rounded-r-none"
            />
            <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md text-white text-sm">
              Search
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {['All','Income','Expense','Transfer'].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              {['All','Cash','Bank Transfer','Card','Cheque'].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/accounts/payments/add" className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Payment
            </Link>
          </Button>
          <Button variant="outline" onClick={exportToCSV} className="flex items-center gap-2">
            <Table className="w-4 h-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportToPrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
        </div>
      </div>

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {payments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">No payments found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("id")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">ID {getSortIcon("id")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("transactionType")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Type {getSortIcon("transactionType")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("category")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Category {getSortIcon("category")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("date")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Date {getSortIcon("date")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("currency")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Currency {getSortIcon("currency")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("amount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Amount {getSortIcon("amount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("fromAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">From {getSortIcon("fromAccount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("toAccount")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">To {getSortIcon("toAccount")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("mode")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Mode {getSortIcon("mode")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("reference")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Reference {getSortIcon("reference")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button onClick={() => handleSort("dueDate")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">Due Date {getSortIcon("dueDate")}</button>
                  </th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                {payments.map((p) => (
                  <tr key={p.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300">
                    <td className="px-4 py-3 font-medium">{p.id}</td>
                    <td className="px-4 py-3">{p.transactionType}</td>
                    <td className="px-4 py-3">{p.category}</td>
                    <td className="px-4 py-3">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{p.currency}</td>
                    <td className="px-4 py-3">{p.currency} {p.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">{p.fromAccount}</td>
                    <td className="px-4 py-3">{p.toAccount}</td>
                    <td className="px-4 py-3">{p.mode}</td>
                    <td className="px-4 py-3">{p.reference}</td>
                    <td className="px-4 py-3">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : ""}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          title="Edit payment"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          title="Delete payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent>
          {paymentToDelete && (
            <DeleteDialog
              entityType="payment"
              entityId={paymentToDelete.id}
              onDelete={handleDeleteSuccess}
              onClose={() => {
                setOpenDeleteDialog(false);
                setPaymentToDelete(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


