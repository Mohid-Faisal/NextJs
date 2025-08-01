"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Recipients } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import Link from "next/link";

const LIMIT = 10;

export default function RecipientsPage() {
  const [recipients, setRecipients] = useState<Recipients[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    const fetchRecipients = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(searchTerm && { search: searchTerm }),
      });

      const res = await fetch(`/api/recipients?${params}`);
      const { recipients, total } = await res.json();
      setRecipients(recipients);
      setTotal(total);
    };

    fetchRecipients();
  }, [page, searchTerm]);

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">All Recipients</h2>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-1">Search</span>
          <Input
            placeholder="Search by recipient..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="w-full max-w-sm"
          />
        </div>
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
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">No recipients found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 dark:text-gray-300 uppercase">
                  <th className="px-4 py-2 text-left">ID</th>
                  <th className="px-4 py-2 text-left">Company Name</th>
                  <th className="px-4 py-2 text-left">Contact Person</th>
                  <th className="px-4 py-2 text-left">Phone</th>
                  <th className="px-4 py-2 text-left">City</th>
                  <th className="px-4 py-2 text-left">Country</th>
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
                      <td className="px-4 py-3">{recipient.Country}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

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
