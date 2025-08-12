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
import { Search, MoreHorizontal, Edit, Trash2, Calendar, Eye, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Country } from "country-state-city";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DeleteDialog from "@/components/DeleteDialog";

const LIMIT = 10;
const STATUSES = ["All", "Pending", "In Transit", "Delivered", "Cancelled"];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
    return { from: twoMonthsAgo, to: now };
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  

  const totalPages = Math.ceil(total / LIMIT);
  type SortField = "awbNumber" | "createdAt" | "senderName" | "recipientName" | "destination" | "deliveryStatus" | "totalCost" | "invoiceStatus";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    const fetchShipments = async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        ...(statusFilter !== "All" && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
        ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
        sortField,
        sortOrder,
      });

      const res = await fetch(`/api/shipments?${params}`);
      const { shipments, total } = await res.json();
      setShipments(shipments);
      setTotal(total);
    };

    fetchShipments();
  }, [page, statusFilter, searchTerm, dateRange, sortField, sortOrder]);

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

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "In Transit":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "Delivered":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      case "Pending":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
      case "Cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  const getInvoiceColor = (status: string | null) => {
    switch (status) {
      case "Paid":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200";
      case "Unpaid":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200";
      case "Overdue":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
    }
  };

  // Function to get country name from country code
  const getCountryName = (countryCode: string | null) => {
    if (!countryCode) return "N/A";
    
    try {
      const countries = Country.getAllCountries();
      const country = countries.find(c => 
        c.isoCode === countryCode || 
        c.name === countryCode
      );
      return country ? country.name : countryCode;
    } catch (error) {
      console.error('Error converting country code:', error);
      return countryCode;
    }
  };

  // Function to format date from createdAt
  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Compact label for the date range button to avoid overflow
  const formatRangeLabelText = (from?: Date, to?: Date) => {
    if (!from) return 'Select date range';
    if (to) {
      const sameYear = from.getFullYear() === to.getFullYear();
      return sameYear
        ? `${format(from, 'MMM d')} - ${format(to, 'MMM d, yyyy')}`
        : `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`;
    }
    return format(from, 'MMM d, yyyy');
  };

  const handleEdit = (shipment: Shipment) => {
    // Redirect to add-shipment with id to enable edit mode and prefill
    window.location.href = `/dashboard/add-shipment?id=${shipment.id}`;
  };

  const handleDelete = async (shipment: Shipment) => {
    setShipmentToDelete(shipment);
    setOpenDeleteDialog(true);
  };

  return (
    <div className="p-10 max-w-7xl mx-auto bg-white dark:bg-zinc-900">
      <h2 className="text-4xl font-bold mb-6 text-gray-800 dark:text-white">
        📦 All Shipments
      </h2>

             {/* Filters */}
       <div className="mb-6 flex justify-between items-end gap-4">
         {/* Left side - Search field */}
         <div>
           <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-1">
             Search
           </span>
           <div className="flex w-full max-w-sm">
             <Input
               placeholder="Search by AWB number, sender, or receiver..."
               value={searchTerm}
               onChange={(e) => {
                 setPage(1);
                 setSearchTerm(e.target.value);
               }}
               className="rounded-r-none"
             />
             <div className="bg-blue-500 px-3 flex items-center justify-center rounded-r-md">
               <Search className="text-white w-5 h-5" />
             </div>
           </div>
         </div>

         {/* Right side - Delivery Status and Date Range */}
         <div className="flex gap-4 items-end">
           {/* Status Filter */}

           {/* Date Range Filter */}
           <div>
             <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-1">
               Date Range
             </span>
             <div className="relative">
               <Button
                 variant="outline"
                 onClick={() => setShowDatePicker(!showDatePicker)}
                 className="min-w-[220px] max-w-[300px] w-auto justify-start text-left font-normal overflow-hidden"
               >
                 <Calendar className="mr-2 h-4 w-4" />
                 <span className="truncate">{formatRangeLabelText(dateRange?.from, dateRange?.to)}</span>
               </Button>
               {showDatePicker && (
                 <div
                   className="absolute right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl overflow-hidden"
                   style={{ width: 'min(360px, 95vw)' }}
                 >
                   <div className="p-4">
                     <div className="mb-4">
                       <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                         Select Date Range
                       </h3>
                       <p className="text-sm text-gray-600 dark:text-gray-400">
                         Choose a date range to filter shipments
                       </p>
                     </div>
                     
                     <DayPicker
                       mode="range"
                       selected={dateRange}
                       onSelect={(range) => {
                         if (range?.from && range?.to) {
                           setDateRange({ from: range.from, to: range.to });
                         } else if (range?.from) {
                           setDateRange({ from: range.from, to: range.from });
                         }
                       }}
                       numberOfMonths={1}
                       className="mb-4 w-full"
                       styles={{
                         months: { display: 'block' },
                         caption: { color: 'inherit', fontSize: '1.1rem', fontWeight: '600' },
                         head_cell: { color: 'inherit', fontWeight: '500' },
                         day: { 
                           color: 'inherit',
                           borderRadius: '6px',
                           margin: '2px',
                           transition: 'all 0.2s'
                         },
                         day_selected: { 
                           backgroundColor: '#3b82f6', 
                           color: 'white',
                           fontWeight: '600'
                         },
                         day_today: { 
                           backgroundColor: '#e5e7eb', 
                           color: 'inherit',
                           fontWeight: '600'
                         },
                         day_range_start: { 
                           backgroundColor: '#3b82f6', 
                           color: 'white',
                           fontWeight: '600'
                         },
                         day_range_end: { 
                           backgroundColor: '#3b82f6', 
                           color: 'white',
                           fontWeight: '600'
                         },
                         day_range_middle: { 
                           backgroundColor: '#dbeafe', 
                           color: 'inherit'
                         },
                         nav_button: {
                           backgroundColor: 'transparent',
                           border: 'none',
                           borderRadius: '6px',
                           padding: '4px',
                           transition: 'all 0.2s'
                         },
                         nav_button_previous: { marginRight: '8px' },
                         nav_button_next: { marginLeft: '8px' }
                       }}
                     />
                     
                     <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                       <div className="flex items-center space-x-4">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => {
                             // Reset to default 2 months range
                             const now = new Date();
                             const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
                             setDateRange({ from: twoMonthsAgo, to: now });
                           }}
                           className="text-gray-600 dark:text-gray-400"
                         >
                           Reset to Default
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => setShowDatePicker(false)}
                           className="text-gray-600 dark:text-gray-400"
                         >
                           Cancel
                         </Button>
                       </div>
                       <Button
                         onClick={() => {
                           setShowDatePicker(false);
                           setPage(1);
                         }}
                         className="bg-blue-600 hover:bg-blue-700 text-white"
                       >
                         Apply Filter
                       </Button>
                     </div>
                   </div>
                 </div>
               )}
             </div>
           </div>
           <div>
             <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 block mb-1">
               Delivery Status
             </span>
             <Select
               value={statusFilter}
               onValueChange={(value) => {
                 setPage(1);
                 setStatusFilter(value);
               }}
             >
               <SelectTrigger className="w-[160px]">
                 <SelectValue placeholder="Select delivery status" />
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
         </div>
       </div>

      {/* Shipments Table */}
      <Card className="shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <CardContent className="p-6 overflow-x-auto">
          {shipments.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-10 text-lg">
              No shipments found.
            </p>
          ) : (
            <table className="min-w-full table-auto border-separate border-spacing-y-4">
                             <thead>
                 <tr className="text-sm text-gray-500 dark:text-gray-300">
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("awbNumber")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       AWB Number {getSortIcon("awbNumber")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("createdAt")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Date {getSortIcon("createdAt")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("senderName")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Sender {getSortIcon("senderName")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("recipientName")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Receiver {getSortIcon("recipientName")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("destination")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Destination {getSortIcon("destination")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("deliveryStatus")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Delivery Status {getSortIcon("deliveryStatus")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("totalCost")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Total Cost {getSortIcon("totalCost")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">
                     <button onClick={() => handleSort("invoiceStatus")} className="flex items-center hover:text-gray-700 dark:hover:text-gray-200">
                       Invoice Status {getSortIcon("invoiceStatus")}
                     </button>
                   </th>
                   <th className="px-4 py-2 text-left">Actions</th>
                 </tr>
               </thead>
              <AnimatePresence>
                <tbody className="text-sm text-gray-700 dark:text-gray-200 font-light">
                  {shipments.map((shipment) => (
                    <motion.tr
                      key={shipment.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-300"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                                         >
                       <td className="px-4 py-3 font-medium">
                         {shipment.awbNumber}
                       </td>
                                               <td className="px-4 py-3">
                          {formatDate(shipment.createdAt)}
                        </td>
                       <td className="px-4 py-3">{shipment.senderName}</td>
                       <td className="px-4 py-3">{shipment.recipientName}</td>
                       <td className="px-4 py-3">{getCountryName(shipment.destination)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            shipment.deliveryStatus
                          )}`}
                        >
                          {shipment.deliveryStatus || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">Rs. {shipment.totalCost}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getInvoiceColor(
                            shipment.invoiceStatus
                          )}`}
                        >
                          {shipment.invoiceStatus || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => handleEdit(shipment)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              window.location.href = `/dashboard/shipments/${shipment.id}`;
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(shipment)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>

                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </AnimatePresence>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <DialogContent className="max-w-md w-full">
          <DeleteDialog
            entityType="shipment"
            entityId={shipmentToDelete?.id || 0}
            onDelete={async () => {
              const params = new URLSearchParams({
                page: String(page),
                limit: String(LIMIT),
                ...(statusFilter !== "All" && { status: statusFilter }),
                ...(searchTerm && { search: searchTerm }),
                ...(dateRange?.from && { fromDate: dateRange.from.toISOString() }),
                ...(dateRange?.to && { toDate: dateRange.to.toISOString() }),
                sortField,
                sortOrder,
              });
              const refreshRes = await fetch(`/api/shipments?${params}`);
              const { shipments, total } = await refreshRes.json();
              setShipments(shipments);
              setTotal(total);
              setShipmentToDelete(null);
            }}
            onClose={() => {
              setOpenDeleteDialog(false);
              setShipmentToDelete(null);
            }}
          />
        </DialogContent>
      </Dialog>

      

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
