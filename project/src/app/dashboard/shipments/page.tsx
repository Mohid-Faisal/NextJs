"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shipment } from "@prisma/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const LIMIT = 10;
const STATUSES = ["All", "Pending", "In Transit", "Delivered", "Cancelled"];
const SORT_OPTIONS = ["Newest", "Oldest"];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortOrder, setSortOrder] = useState("Newest");
  const [searchTerm, setSearchTerm] = useState("");

  const totalPages = Math.ceil(total / LIMIT);

  useEffect(() => {
    const fetchShipments = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(sortOrder && { sort: sortOrder }),
        ...(searchTerm && { search: searchTerm }),
      });

      const res = await fetch(`/api/shipments?${params}`);
      const { shipments, total } = await res.json();
      setShipments(shipments);
      setTotal(total);
    };

    fetchShipments();
  }, [page, statusFilter, sortOrder, searchTerm]);

  const getStatusColor = (status: Shipment["status"]) => {
    switch (status) {
      case "In Transit":
        return "bg-yellow-100 text-yellow-800";
      case "Delivered":
        return "bg-green-100 text-green-800";
      case "Pending":
        return "bg-blue-100 text-blue-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getInvoiceColor = (status: string) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700";
      case "Unpaid":
        return "bg-red-100 text-red-700";
      case "Overdue":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <h2 className="text-4xl font-bold mb-6 text-gray-800">📦 All Shipments</h2>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        {/* Status Filter */}
        <div>
          <span className="text-sm font-semibold text-gray-600 block mb-1">Status</span>
          <Select value={statusFilter} onValueChange={(value) => {
            setPage(1);
            setStatusFilter(value);
          }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sort by Date */}
        <div>
          <span className="text-sm font-semibold text-gray-600 block mb-1">Sort by Date</span>
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search Input */}
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-600 block mb-1">Search</span>
          <Input
            placeholder="Search by tracking ID, sender, or receiver..."
            value={searchTerm}
            onChange={(e) => {
              setPage(1);
              setSearchTerm(e.target.value);
            }}
            className="w-full max-w-sm"
          />
        </div>
      </div>

      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200">
        <CardContent className="p-6 overflow-x-auto">
          {shipments.length === 0 ? (
            <p className="text-gray-600 text-center py-10 text-lg">No shipments found.</p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
              <thead>
                <tr className="text-sm text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Tracking ID</th>
                  <th className="px-4 py-2 text-left">Sender</th>
                  <th className="px-4 py-2 text-left">Receiver</th>
                  <th className="px-4 py-2 text-left">Destination</th>
                  <th className="px-4 py-2 text-left">Payment</th>
                  <th className="px-4 py-2 text-left">Invoice</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Total Cost</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-right">Action</th>
                </tr>
              </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 font-light">
                  {shipments.map((shipment) => (
                    <motion.tr
                      key={shipment.id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                    >
                      <td className="px-4 py-3 font-medium">{shipment.trackingId}</td>
                      <td className="px-4 py-3">{shipment.senderName}</td>
                      <td className="px-4 py-3">{shipment.recipientName}</td>
                      <td className="px-4 py-3">{shipment.recipientAddress}</td>
                      <td className="px-4 py-3">{shipment.paymentMethod}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getInvoiceColor(shipment.invoiceStatus)}`}>
                          {shipment.invoiceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(shipment.status)}`}>
                          {shipment.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">Rs. {shipment.totalCost}</td>
                      <td className="px-4 py-3">{new Date(shipment.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" className="hover:scale-105 transition-transform">
                          View
                        </Button>
                      </td>
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
        <div className="mt-6 flex justify-between items-center text-sm text-gray-600">
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
