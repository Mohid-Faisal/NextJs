"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recipients } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Plus, EllipsisVertical, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Country as country } from "country-state-city";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import DeleteDialog from "@/components/DeleteDialog";
import ViewRecipientDialog from "@/components/ViewRecipientDialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const LIMIT = 10;

type SortField = "id" | "CompanyName" | "PersonName" | "Phone" | "City" | "Country";
type SortOrder = "asc" | "desc";

export default function RecipientsPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipients[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [recipientToDelete, setRecipientToDelete] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const totalPages = Math.ceil(total / LIMIT);

  const fetchRecipients = async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      ...(searchTerm && { search: searchTerm }),
      sortField: sortField,
      sortOrder: sortOrder,
    });

    const res = await fetch(`/api/recipients?${params}`);
    const { recipients, total } = await res.json();
    setRecipients(recipients);
    setTotal(total);
  };

  useEffect(() => {
    fetchRecipients();
  }, [page, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">
        All Recipients
      </h2>

      {/* Filters */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        {/* Search bar with icon */}
        <div className="flex w-full max-w-sm">
          {/* Search input */}
          <Input
            placeholder="Search by recipient..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="rounded-r-none"
          />
          {/* Icon box */}
          <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md">
            <Search className="text-white s w-5 h-5" />
          </div>
        </div>

        {/* Add Recipient button aligned to far right */}
        <div className="flex justify-end">
          <Button asChild>
            <Link href="/dashboard/recipients/add-recipients">
              <Plus className="w-4 h-4 mr-2" />
              Add Recipient
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {recipients.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No recipients found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300">
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("id")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      ID {getSortIcon("id")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("CompanyName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Company Name {getSortIcon("CompanyName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("PersonName")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Contact Person {getSortIcon("PersonName")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Phone")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Phone {getSortIcon("Phone")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("City")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      City {getSortIcon("City")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">
                    <button
                      onClick={() => handleSort("Country")}
                      className="flex items-center hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    >
                      Country {getSortIcon("Country")}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left">Action</th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                  {recipients.map((recipient) => (
                    <motion.tr
                      key={recipient.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3 font-medium">{recipient.id}</td>
                      <td className="px-4 py-3">{recipient.CompanyName}</td>
                      <td className="px-4 py-3">{recipient.PersonName}</td>
                      <td className="px-4 py-3">{recipient.Phone}</td>
                      <td className="px-4 py-3">{recipient.City}</td>
                      <td className="px-4 py-3">
                        {country.getCountryByCode(recipient.Country)?.name}
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 hover:bg-gray-100 rounded">
                              <EllipsisVertical />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="w-36">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`recipients/add-recipients?id=${recipient.id}`)
                              }
                            >
                              ✏️ Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRecipientToDelete(recipient);
                                setOpenDeleteDialog(true);
                              }}
                            >
                              🗑️ Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedRecipient(recipient);
                                setOpenViewDialog(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Dialog
                          open={openDeleteDialog}
                          onOpenChange={setOpenDeleteDialog}
                        >
                          <DialogContent className="max-w-md w-full">
                            <DeleteDialog
                              entityType="recipient"
                              entityId={recipientToDelete?.id || 0}
                              onDelete={() => {
                                fetchRecipients();
                                setRecipientToDelete(null);
                              }}
                              onClose={() => {
                                setOpenDeleteDialog(false);
                                setRecipientToDelete(null);
                              }}
                            />
                          </DialogContent>
                        </Dialog>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

      {/* View Recipient Dialog */}
      <ViewRecipientDialog
        recipient={selectedRecipient}
        open={openViewDialog}
        onOpenChange={setOpenViewDialog}
      />

      {/* Pagination */}
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
    </div>
  );
}
