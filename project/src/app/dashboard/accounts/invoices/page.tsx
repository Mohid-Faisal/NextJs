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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import {
  Table,
  Plus,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Printer,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
} from "lucide-react";
import DeleteDialog from "@/components/DeleteDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Invoice = {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  receiptNumber?: string;
  trackingNumber?: string;
  referenceNumber?: string;
  destination: string;
  dayWeek?: string;
  weight: number;
  profile: string;
  fscCharges: number;
  lineItems: any[];
  status: string;
  totalAmount: number;
  currency: string;
  customer?: {
    CompanyName: string;
    PersonName: string;
  };
  vendor?: {
    CompanyName: string;
    PersonName: string;
  };
  shipment?: {
    trackingId: string;
    awbNumber: string;
  };
  createdAt: string;
};

type SortField = keyof Invoice;
type SortOrder = "asc" | "desc";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(10);
  const totalPages =
    pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(total / (pageSize as number)));

  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");

  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  useEffect(() => {
    const fetchInvoices = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: pageSize === "all" ? "all" : String(pageSize),
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        sortField: sortField,
        sortOrder: sortOrder,
      });

      const res = await fetch(`/api/accounts/invoices?${params.toString()}`);
      const json = await res.json();
      console.log('Invoices data:', json.invoices); // Debug log
      setInvoices(json.invoices);
      setTotal(json.total);
    };

    fetchInvoices();
  }, [page, pageSize, statusFilter, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const handleDelete = async () => {
    // This function will be called by DeleteDialog after successful deletion
    const params = new URLSearchParams({
      page: String(page),
      limit: pageSize === "all" ? "all" : String(pageSize),
      ...(statusFilter !== "All" && { status: statusFilter }),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });
    const res = await fetch(`/api/accounts/invoices?${params.toString()}`);
    const json = await res.json();
    setInvoices(json.invoices);
    setTotal(json.total);
  };

  const handleStatusChange = async (invoiceId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/accounts/invoices/${invoiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (response.ok) {
        // Update the local state to reflect the change
        setInvoices(prevInvoices =>
          prevInvoices.map(invoice =>
            invoice.id === invoiceId
              ? { ...invoice, status: newStatus }
              : invoice
          )
        );
      } else {
        console.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
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
    () => invoices.reduce((acc, i) => acc + i.totalAmount, 0),
    [invoices]
  );

  const exportToCSV = () => {
    const headers = [
      "ID",
      "Invoice #",
      "Date",
      "Receipt #",
      "Tracking #",
      "Reference #",
      "Destination",
      "Weight",
      "Status",
      "Total Amount",
      "Customer/Vendor",
    ];
    const rows = invoices.map((i) => [
      i.id,
      i.invoiceNumber,
      new Date(i.invoiceDate).toLocaleDateString(),
      i.receiptNumber || "",
      i.trackingNumber || "",
      i.referenceNumber || "",
      i.destination,
      i.weight,
      i.status,
      `${i.currency} ${i.totalAmount.toLocaleString()}`,
             (i.customer?.PersonName || i.customer?.CompanyName) || (i.vendor?.PersonName || i.vendor?.CompanyName) || "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `invoices_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const exportToPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = invoices
      .map(
        (i) => `
        <tr>
          <td>${i.id}</td>
          <td>${i.invoiceNumber}</td>
          <td>${new Date(i.invoiceDate).toLocaleDateString()}</td>
          <td>${i.receiptNumber || ""}</td>
          <td>${i.trackingNumber || ""}</td>
          <td>${i.referenceNumber || ""}</td>
          <td>${i.destination}</td>
          <td>${i.weight}</td>
          <td>${i.status}</td>
          <td>${i.currency} ${i.totalAmount.toLocaleString()}</td>
          <td>${(i.customer?.PersonName || i.customer?.CompanyName) || (i.vendor?.PersonName || i.vendor?.CompanyName) || ""}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoices</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Invoices</h1>
          <p>Total Amount: ${totalAmount.toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Receipt #</th>
                <th>Tracking #</th>
                <th>Reference #</th>
                <th>Destination</th>
                <th>Weight</th>
                <th>Status</th>
                <th>Total Amount</th>
                <th>Customer/Vendor</th>
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
        <h2 className="text-4xl font-bold text-gray-800 dark:text-white">
          Invoices
        </h2>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
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
              placeholder="Search by invoice #, tracking #, customer..."
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
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {["All", "Pending", "Paid", "Overdue", "Cancelled"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button asChild>
            <Link
              href="/dashboard/accounts/invoices/add"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Invoice
            </Link>
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

      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {invoices.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No invoices found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      ID {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Invoice# {getSortIcon("invoiceNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("invoiceDate")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Date {getSortIcon("invoiceDate")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("trackingNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Tracking# {getSortIcon("trackingNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("referenceNumber")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Reference# {getSortIcon("referenceNumber")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("destination")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Destination {getSortIcon("destination")}
                    </button>
                  </th>

                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("weight")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Weight {getSortIcon("weight")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("status")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Status {getSortIcon("status")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("totalAmount")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      Total Amount {getSortIcon("totalAmount")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">Customer/Vendor</th>
                  <th className="px-4 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                  >
                    <td className="px-4 py-3 font-medium">{i.id}</td>
                    <td className="px-4 py-3">{i.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      {new Date(i.invoiceDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{i.trackingNumber || "-"}</td>
                    <td className="px-4 py-3">{i.referenceNumber || "-"}</td>
                    <td className="px-4 py-3">{i.destination}</td>

                    <td className="px-4 py-3">{i.weight}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          i.status === "Paid"
                            ? "bg-green-100 text-green-800"
                            : i.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : i.status === "Overdue"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {i.currency} {i.totalAmount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const customerName = i.customer?.PersonName || i.customer?.CompanyName;
                        const vendorName = i.vendor?.PersonName || i.vendor?.CompanyName;
                        console.log(`Invoice ${i.id}: customer=${customerName}, vendor=${vendorName}`); // Debug log
                        return customerName || vendorName || "-";
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/dashboard/accounts/invoices/add?id=${i.id}`;
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInvoiceToDelete(i);
                              setOpenDeleteDialog(true);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/api/accounts/invoices/${i.id}/receipt`;
                            }}
                          >
                            📄 Download Receipt
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              window.location.href = `/api/accounts/invoices/${i.id}/invoice`;
                            }}
                          >
                            🧾 Download Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Pending")}
                            className={i.status === "Pending" ? "bg-yellow-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-yellow-100 text-yellow-800 text-xs flex items-center justify-center">P</span>
                            Mark as Pending
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Paid")}
                            className={i.status === "Paid" ? "bg-green-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-green-100 text-green-800 text-xs flex items-center justify-center">✓</span>
                            Mark as Paid
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Overdue")}
                            className={i.status === "Overdue" ? "bg-red-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-red-100 text-red-800 text-xs flex items-center justify-center">!</span>
                            Mark as Overdue
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleStatusChange(i.id, "Cancelled")}
                            className={i.status === "Cancelled" ? "bg-gray-50" : ""}
                          >
                            <span className="mr-2 h-4 w-4 rounded-full bg-gray-100 text-gray-800 text-xs flex items-center justify-center">✕</span>
                            Mark as Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Delete Dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="max-w-md w-full">
          <DeleteDialog
            entityType="invoice"
            entityId={invoiceToDelete?.id || 0}
            onDelete={() => {
              handleDelete();
              setInvoiceToDelete(null);
            }}
            onClose={() => {
              setOpenDeleteDialog(false);
              setInvoiceToDelete(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
