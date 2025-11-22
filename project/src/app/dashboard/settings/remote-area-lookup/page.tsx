"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Search, Trash2, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RemoteAreaLookupPage = () => {
  const router = useRouter();
  const [remoteAreas, setRemoteAreas] = useState<any[] | null>(null);
  const [filteredAreas, setFilteredAreas] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [formattedTime, setFormattedTime] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Fetch remote areas on mount
  useEffect(() => {
    fetchRemoteAreas();
  }, []);

  // Upload Excel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast.error("Please select a file to upload.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/remote-areas", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        toast.success("Remote area list uploaded successfully!");
        fetchRemoteAreas();
      } else {
        toast.error(result.message || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload file");
    } finally {
      setIsLoading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  // Fetch remote areas - always fetch all data to populate companies list
  const fetchRemoteAreas = async () => {
    try {
      const res = await fetch("/api/remote-areas");
      const result = await res.json();
      if (result.success) {
        if (result.data.length > 0) {
          const time = result.data[0].uploadedAt.replace(/Z$/, '');
          const formattedTime = new Date(time).toLocaleString('en-PK', {
            timeZone: 'Asia/Karachi',
            hour12: true,
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setFormattedTime(formattedTime);
        }
        setRemoteAreas(result.data);
        setFilteredAreas(result.data);
        
        // Extract unique companies from ALL data (not filtered)
        const uniqueCompanies = [...new Set(result.data.map((area: any) => String(area.company || '')).filter(Boolean))] as string[];
        setCompanies(uniqueCompanies.sort());
      } else {
        setRemoteAreas([]);
        setFilteredAreas([]);
        setFormattedTime('');
        setCompanies([]);
      }
    } catch (error) {
      console.error("Failed to fetch remote areas", error);
      setRemoteAreas([]);
      setFilteredAreas([]);
      setCompanies([]);
    }
  };

  // Sort function
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort data function
  const sortData = (data: any[]) => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      if (sortConfig.direction === 'asc') {
        return aValue.toString().localeCompare(bValue.toString());
      } else {
        return bValue.toString().localeCompare(aValue.toString());
      }
    });
  };

  // Filter areas by search and company
  useEffect(() => {
    let filtered = remoteAreas || [];
    
    // Filter by company if selected
    if (selectedCompany) {
      filtered = filtered.filter(area => area.company === selectedCompany);
    }
    
    // Filter by search term
    if (search) {
      const term = search.toLowerCase().trim();
      
      // Check if search term is a number (zip code)
      const searchNumber = parseFloat(term);
      const isNumericSearch = !isNaN(searchNumber) && term === searchNumber.toString();
      
      filtered = filtered.filter((area) => {
        // If search is numeric, check if it falls within the zip code range
        if (isNumericSearch) {
          const low = parseFloat(area.low || '0');
          const high = parseFloat(area.high || '0');
          
          // Check if search number is within the range
          if (!isNaN(low) && !isNaN(high)) {
            if (searchNumber >= low && searchNumber <= high) {
              return true;
            }
          }
          
          // Also check if the number matches low or high exactly (as string)
          if (area.low?.includes(term) || area.high?.includes(term)) {
            return true;
          }
        }
        
        // Text search for all fields
        return (
          area.company?.toLowerCase().includes(term) ||
          area.country?.toLowerCase().includes(term) ||
          area.iataCode?.toLowerCase().includes(term) ||
          area.low?.toLowerCase().includes(term) ||
          area.high?.toLowerCase().includes(term) ||
          area.city?.toLowerCase().includes(term)
        );
      });
    }
    
    const sortedData = sortData(filtered);
    setFilteredAreas(sortedData);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [search, selectedCompany, remoteAreas, sortConfig]);

  // Note: We don't refetch when company changes - we just filter locally

  // Calculate pagination
  const totalPages = filteredAreas ? Math.ceil(filteredAreas.length / itemsPerPage) : 0;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAreas = filteredAreas ? filteredAreas.slice(startIndex, endIndex) : [];

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete remote areas (all or by company)
  const handleDelete = async () => {
    const confirmMessage = selectedCompany
      ? `Are you sure you want to delete all remote area data for "${selectedCompany}"? This action cannot be undone.`
      : "Are you sure you want to delete all remote area data? This action cannot be undone.";
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const url = selectedCompany
        ? `/api/remote-areas?company=${encodeURIComponent(selectedCompany)}`
        : "/api/remote-areas";
      
      const response = await fetch(url, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        const message = selectedCompany
          ? `Remote area data for "${selectedCompany}" has been deleted successfully!`
          : "All remote area data has been deleted successfully!";
        toast.success(message);
        
        // Refresh data
        fetchRemoteAreas();
        setSelectedCompany("");
        setSearch('');
      } else {
        toast.error(result.message || "Failed to delete remote area data");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete remote area data");
    }
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        {/* Back Button */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <Card className="bg-white dark:bg-gray-900 border shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-8">
            <h1 className="text-xl sm:text-2xl font-semibold text-primary text-center">
              Remote Area
            </h1>

            {/* Info Section */}
            {remoteAreas && remoteAreas.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                  <div>
                    <h2 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                      Remote Area Data
                    </h2>
                    <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                      {remoteAreas.length} total entries • {filteredAreas?.length || remoteAreas.length} displayed
                      {selectedCompany && ` • Filtered by: ${selectedCompany}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg sm:text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {remoteAreas.length}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      Total Entries
                    </div>
                  </div>
                </div>
                
                {/* Statistics */}
                {remoteAreas.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                      <div className="text-center">
                        <div className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {new Set(remoteAreas.map(a => a.country)).size}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Unique Countries
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {new Set(remoteAreas.map(a => a.iataCode)).size}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Unique IATA Codes
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {remoteAreas.filter(a => a.city && a.city !== "").length}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          With Cities
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {remoteAreas[0]?.filename || 'Unknown'}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          File Name
                        </div>
                      </div>
                    </div>
                    
                    {/* Last Updated Info */}
                    {formattedTime && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex items-center justify-end gap-2">
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            📅 Last updated:
                          </div>
                          <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {formattedTime}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Search and Actions */}
            <div className="flex flex-col md:flex-row items-end justify-between gap-4">
              {/* Company Filter and Search */}
              <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                {/* Company Filter */}
                {companies.length > 0 && (
                  <div className="space-y-1.5 w-full md:w-[200px]">
                    <Select
                      value={selectedCompany || "all"}
                      onValueChange={(value) => {
                        setSelectedCompany(value === "all" ? "" : value);
                        setSearch("");
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Companies" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Companies</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company} value={company}>
                            {company}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Search input */}
                <div className="space-y-1.5 w-full md:w-[320px]">
                  <div className="flex w-full">
                    <Input
                      id="search"
                      placeholder="Search by company, country, IATA code, city..."
                      className="h-9 text-sm rounded-r-none"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      disabled={!remoteAreas || remoteAreas.length === 0}
                    />
                    <div className="flex items-center justify-center px-3 bg-blue-600 text-white rounded-r-md">
                      <Search className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleDelete}
                  disabled={!remoteAreas || remoteAreas.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title={selectedCompany ? `Delete remote area data for ${selectedCompany}` : "Delete all remote area data"}
                >
                  <Trash2 className="w-4 h-4" />
                  {selectedCompany ? `Delete ${selectedCompany}` : "Delete All"}
                </button>
                <label
                  htmlFor="file"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Paperclip className="w-4 h-4" />
                  {isLoading ? "Uploading..." : "Upload Excel file"}
                </label>
                <input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUpload}
                  disabled={isLoading}
                  className="hidden"
                />
              </div>
            </div>

            {/* Table */}
            {filteredAreas && filteredAreas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-auto mt-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Remote Area Details
                    </h3>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAreas?.length || 0)} of {filteredAreas?.length || 0} entries
                    {filteredAreas && filteredAreas.length !== (remoteAreas?.length || 0) && ` (filtered from ${remoteAreas?.length || 0} total)`}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 text-sm border rounded shadow">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-left">
                      <tr>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('company')}
                        >
                          <div className="flex items-center justify-between">
                            <span>Company</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'company' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'company' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('country')}
                        >
                          <div className="flex items-center justify-between">
                            <span>Country</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'country' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'country' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('iataCode')}
                        >
                          <div className="flex items-center justify-between">
                            <span>IATA Code</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'iataCode' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'iataCode' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('low')}
                        >
                          <div className="flex items-center justify-between">
                            <span>Low</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'low' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'low' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('high')}
                        >
                          <div className="flex items-center justify-between">
                            <span>High</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'high' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'high' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                        <th 
                          className="px-4 py-2 border cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                          onClick={() => handleSort('city')}
                        >
                          <div className="flex items-center justify-between">
                            <span>City</span>
                            <div className="flex flex-col">
                              <span className={`text-xs ${sortConfig?.key === 'city' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                              <span className={`text-xs ${sortConfig?.key === 'city' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAreas.map((area, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-2 border">{area.company}</td>
                          <td className="px-4 py-2 border">{area.country}</td>
                          <td className="px-4 py-2 border">{area.iataCode}</td>
                          <td className="px-4 py-2 border">{area.low}</td>
                          <td className="px-4 py-2 border">{area.high}</td>
                          <td className="px-4 py-2 border">{area.city || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Items per page selector */}
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600 dark:text-gray-400">
                        Items per page:
                      </Label>
                      <Select
                        value={itemsPerPage.toString()}
                        onValueChange={(value: string) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Page navigation */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(pageNum)}
                              className="w-10 h-9"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Page info */}
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Page {currentPage} of {totalPages}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {remoteAreas?.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4">
                No remote area data found. Please upload an Excel file to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default RemoteAreaLookupPage;

