"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, Search, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const ManageRateListPage = () => {
  const router = useRouter();
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedVendorName, setSelectedVendorName] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [rates, setRates] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [allVendorServices, setAllVendorServices] = useState<any[]>([]);
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<{
    [key: string]: {
      fileName: string;
      vendor: string;
      service: string;
    };
  }>({});
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch vendors and services on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch vendors
        const vendorRes = await fetch("/api/rate-vendor");
        const vendorData = await vendorRes.json();

        // Map CompanyName to name
        const transformedVendors = vendorData.map((vendor: any) => ({
          id: vendor.id,
          name: vendor.CompanyName,
        }));
        
        setVendors(transformedVendors);

        // Fetch vendor services
        const vendorServiceRes = await fetch("/api/settings/vendorService");
        const vendorServiceData = await vendorServiceRes.json();

        if (vendorServiceData && Array.isArray(vendorServiceData)) {
          setAllVendorServices(vendorServiceData);
          
          // Extract unique services from vendor services
          const uniqueServices = new Map();
          vendorServiceData.forEach((item: any) => {
            if (item.service && !uniqueServices.has(item.service)) {
              uniqueServices.set(item.service, {
                id: item.service, // Use service name as ID
                name: item.service,
              });
            }
          });
          setServices(Array.from(uniqueServices.values()));
        }

        // Fetch all available rate lists
        const filenamesRes = await fetch("/api/filenames");
        const filenamesData = await filenamesRes.json();
        
        if (filenamesData.success && filenamesData.data && Array.isArray(filenamesData.data)) {
          const allFiles: { [key: string]: { fileName: string; vendor: string; service: string } } = {};
          
          filenamesData.data.forEach((fileInfo: any) => {
            const fileKey = `${fileInfo.vendor}-${fileInfo.service}`;
            allFiles[fileKey] = {
              fileName: fileInfo.filename,
              vendor: fileInfo.vendor,
              service: fileInfo.service
            };
          });
          
          setUploadedFiles(allFiles);
        }
        
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);



  // Upload Excel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedServiceName) {
      toast.error("Please select a service and upload a file.");
      return;
    }

    if (!selectedVendorName) {
      toast.error("Please select a vendor to upload rates for.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("vendor", selectedVendorName); // Send name, not ID
    formData.append("service", selectedServiceName); // Send service name

    const res = await fetch("/api/rates", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      toast.success("Rate list uploaded successfully!");
      
      // Create a unique key for this vendor-service combination
      const fileKey = `${selectedVendorName}-${selectedServiceName}`;
      
      // Store the file info for this specific vendor-service combination
      setUploadedFiles(prev => ({
        ...prev,
        [fileKey]: {
          fileName: file.name,
          vendor: selectedVendorName, 
          service: selectedServiceName
        }
      }));
      
      fetchRates(selectedVendorName, selectedServiceName, 1, search);
    } else {
      toast.error(result.message || "Upload failed");
    }
  };

  // Fetch rates by vendor name and service with pagination
  const fetchRates = async (vendorName: string, serviceName: string, page: number = 1, searchTerm: string = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        service: serviceName,
        page: page.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm })
      });

      // If vendor is selected, include it in the search
      if (vendorName) {
        params.append("vendor", vendorName);
      }

      const res = await fetch(`/api/rates?${params}`);
      const result = await res.json();
      
      if (result.success) {
        setRates(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setCurrentPage(result.page);
      } else {
        setRates([]);
        setTotal(0);
        setTotalPages(0);
      }
    } catch (error) {
      console.error("Failed to fetch rates", error);
      setRates([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Refetch rates when vendor or service changes
  useEffect(() => {
    if (selectedServiceName) {
      fetchRates(selectedVendorName, selectedServiceName, 1, search);
    }
  }, [selectedVendorName, selectedServiceName]);

  // Filter services based on selected vendor
  const filterServicesByVendor = (vendorName: string) => {
    if (!vendorName) {
      // If no vendor selected, show all services
      const uniqueServices = new Map();
      allVendorServices.forEach((item: any) => {
        if (item.service && !uniqueServices.has(item.service)) {
          uniqueServices.set(item.service, {
            id: item.service,
            name: item.service,
          });
        }
      });
      setServices(Array.from(uniqueServices.values()));
      return;
    }

    // Filter services for the selected vendor
    const vendorServices = allVendorServices.filter(
      (item: any) => item.vendor === vendorName
    );
    
    const uniqueServices = new Map();
    vendorServices.forEach((item: any) => {
      if (item.service && !uniqueServices.has(item.service)) {
        uniqueServices.set(item.service, {
          id: item.service,
          name: item.service,
        });
      }
    });
    setServices(Array.from(uniqueServices.values()));
  };

  // Handle search
  const handleSearch = () => {
    if (selectedServiceName) {
      fetchRates(selectedVendorName, selectedServiceName, 1, search);
    }
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (selectedServiceName) {
      fetchRates(selectedVendorName, selectedServiceName, page, search);
    }
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  // Handle search on Enter key
  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // Handle delete rates
  const handleDeleteRates = async () => {
    if (!selectedServiceName) {
      toast.error("Please select a service.");
      return;
    }

    if (!selectedVendorName) {
      toast.error("Please select a vendor to delete rates for.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete all rates for ${selectedVendorName} - ${selectedServiceName}? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch("/api/rates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendor: selectedVendorName,
          service: selectedServiceName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully deleted all rates for ${selectedVendorName} - ${selectedServiceName}`);
        setRates([]);
        setTotal(0);
        setTotalPages(0);
        setCurrentPage(1);
        
        // Remove the filename for this vendor-service combination
        const fileKey = `${selectedVendorName}-${selectedServiceName}`;
        setUploadedFiles(prev => {
          const newFiles = { ...prev };
          delete newFiles[fileKey];
          return newFiles;
        });
      } else {
        toast.error(result.message || "Failed to delete rates");
      }
    } catch (error) {
      console.error("Failed to delete rates", error);
      toast.error("Failed to delete rates");
    }
  };

  // Handle file open
  const handleFileOpen = (fileKey: string) => {
    const fileInfo = uploadedFiles[fileKey];
    if (fileInfo) {
      // Since we don't have the actual file, just show a message
      toast.info(`File: ${fileInfo.fileName} was uploaded for ${fileInfo.vendor} - ${fileInfo.service}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
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
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <Card className="bg-white dark:bg-gray-900 border shadow-sm rounded-2xl">
          <CardContent className="p-3 sm:p-4 lg:p-8 space-y-4 sm:space-y-8">
            <h1 className="text-xl sm:text-2xl font-semibold text-primary text-center">
              Manage Rate List
            </h1>

            {/* Vendor + Search row */}
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex flex-col lg:flex-row gap-2 w-full">
                {/* Select Vendor */}
                <div className="space-y-1.5 w-full lg:w-48">
                  <Select
                    onValueChange={(vendorId) => {
                      const vendor = vendors.find((v) => v.id === vendorId);
                      const vendorName = vendor?.name || "";
                      setSelectedVendor(vendorId);
                      setSelectedVendorName(vendorName);
                      setSearch("");
                      setCurrentPage(1);
                      
                      // Filter services based on selected vendor
                      filterServicesByVendor(vendorName);
                      
                      // Clear selected service when vendor changes
                      setSelectedService("");
                      setSelectedServiceName("");
                    }}
                    value={selectedVendor}
                  >
                    <SelectTrigger className="text-xs sm:text-sm w-full lg:w-48 h-9">
                      <SelectValue placeholder="Choose a Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-xs sm:text-sm">
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Service */}
                <div className="space-y-1.5 w-full lg:w-48">
                  <Select
                    onValueChange={(serviceId) => {
                      const service = services.find((s) => s.id === serviceId);
                      setSelectedService(serviceId);
                      setSelectedServiceName(service?.name || "");
                      setSearch("");
                      setCurrentPage(1);
                    }}
                    value={selectedService}
                  >
                    <SelectTrigger className="text-xs sm:text-sm w-full lg:w-48 h-9">
                      <SelectValue placeholder="Choose a Service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs sm:text-sm">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search input */}
                <div className="space-y-1.5 w-full lg:w-[240px]">
                  <div className="flex w-full">
                    <Input
                      id="search"
                      placeholder="Search by zone, weight, price, or doc type..."
                      className="h-9 text-xs sm:text-sm rounded-r-none"
                      value={search}
                      onChange={handleSearchChange}
                      onKeyPress={handleSearchKeyPress}
                      disabled={!rates || !selectedServiceName}
                    />
                    <Button
                      onClick={handleSearch}
                      disabled={!selectedServiceName}
                      className="h-9 px-3 bg-blue-600 text-white rounded-r-md hover:bg-blue-700"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Upload and Filename row */}
              <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center">
                <label
                  htmlFor="file"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md cursor-pointer hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full lg:w-auto"
                  style={{ opacity: (!selectedVendorName || !selectedServiceName) ? 0.5 : 1 }}
                >
                  <Paperclip className="w-4 h-4" />
                  Upload Excel file
                </label>
                <input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleUpload}
                  disabled={!selectedVendorName || !selectedServiceName}
                  className="hidden"
                />
                
                {/* Display uploaded filename for current vendor-service combination */}
                {(() => {
                  const fileKey = `${selectedVendorName}-${selectedServiceName}`;
                  const currentFileInfo = uploadedFiles[fileKey];
                  
                  return currentFileInfo ? (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleFileOpen(fileKey);
                        }}
                        className="inline-flex items-center px-3 py-2 bg-green-100 text-green-800 text-xs sm:text-sm font-medium rounded border border-green-300 hover:bg-green-200 transition cursor-pointer max-w-full break-all"
                      >
                        {currentFileInfo.fileName}
                      </button>
                    </div>
                  ) : null;
                })()}
                
                <Button
                  onClick={handleDeleteRates}
                  disabled={!selectedVendorName || !selectedServiceName}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed w-full lg:w-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Rates
                </Button>
              </div>
            </div>

            {/* Rate Table */}
            {rates && rates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3 sm:space-y-4"
              >
                <div className="overflow-auto">
                  <table className="min-w-full bg-white dark:bg-gray-800 text-xs sm:text-sm border rounded shadow border-separate border-spacing-y-2 sm:border-spacing-y-4">
                    <thead className="bg-gray-100 dark:bg-gray-700 text-left">
                      <tr>
                        <th className="px-2 sm:px-4 py-2 border w-24 text-xs sm:text-sm">Zone</th>
                        <th className="px-2 sm:px-4 py-2 border w-32 text-xs sm:text-sm">Weight (kg)</th>
                        <th className="px-2 sm:px-4 py-2 border w-32 text-xs sm:text-sm">Price</th>
                        <th className="px-2 sm:px-4 py-2 border w-32 text-xs sm:text-sm">Service</th>
                        <th className="px-2 sm:px-4 py-2 border w-32 text-xs sm:text-sm">Doc Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((rate, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-2 sm:px-4 py-2 border text-xs sm:text-sm">{rate.zone}</td>
                          <td className="px-2 sm:px-4 py-2 border text-xs sm:text-sm">{rate.weight}</td>
                          <td className="px-2 sm:px-4 py-2 border text-xs sm:text-sm">{rate.price}</td>
                          <td className="px-2 sm:px-4 py-2 border text-xs sm:text-sm">{rate.service}</td>
                          <td className="px-2 sm:px-4 py-2 border text-xs sm:text-sm">{rate.docType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, total)} of {total} results
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="w-full sm:w-auto"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => handlePageChange(page)}
                              className="w-8 h-8"
                            >
                              {page}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="w-full sm:w-auto"
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-xs sm:text-sm">Loading rates...</p>
              </div>
            )}

            {/* Empty state */}
            {!loading && rates?.length === 0 && selectedServiceName && selectedVendorName && (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4 text-xs sm:text-sm">
                No rates found for {selectedVendorName} - {selectedServiceName}.
              </p>
            )}

            {/* No service selected */}
            {!selectedServiceName && (
              <p className="text-center text-gray-500 dark:text-gray-400 mt-4 text-xs sm:text-sm">
                Please select a service to view rates.
              </p>
            )}

            {/* Available Rate Lists Section */}
            <div className="mt-4 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 sm:mb-4">
                Available Rate Lists
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                {Object.entries(uploadedFiles).map(([fileKey, fileInfo]) => (
                  <div
                    key={fileKey}
                    className="p-2 sm:p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedVendorName(fileInfo.vendor);
                      setSelectedServiceName(fileInfo.service);
                      // Find vendor ID from name
                      const vendor = vendors.find(v => v.name === fileInfo.vendor);
                      if (vendor) {
                        setSelectedVendor(vendor.id);
                      }
                      // Find service ID from name
                      const service = services.find(s => s.name === fileInfo.service);
                      if (service) {
                        setSelectedService(service.id);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-xs sm:text-sm text-green-800 dark:text-green-200">
                          {fileInfo.vendor}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-300">
                          {fileInfo.service}
                        </p>
                        <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                          {fileInfo.fileName}
                        </p>
                      </div>
                      <div className="text-green-600 dark:text-green-400">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {Object.keys(uploadedFiles).length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-xs sm:text-sm">
                  No rate lists have been uploaded yet. Upload your first rate list above.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ManageRateListPage;
