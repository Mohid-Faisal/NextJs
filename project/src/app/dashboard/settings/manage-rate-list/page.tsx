"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, Search, ChevronLeft, ChevronRight } from "lucide-react";
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

const ManageRateListPage = () => {
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedVendorName, setSelectedVendorName] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [rates, setRates] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
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

        // Fetch services
        const serviceRes = await fetch("/api/services");
        const serviceData = await serviceRes.json();

        if (serviceData.success) {
          const transformedServices = serviceData.data.map((service: any) => ({
            id: service.id.toString(),
            name: service.name,
          }));
          setServices(transformedServices);
        }
        
      } catch (error) {
        console.error("Failed to fetch data", error);
      }
    };
    fetchData();
  }, []);

  // Fetch filename for current vendor-service combination
  const fetchFilename = async (vendorName: string, serviceName: string) => {
    if (!vendorName || !serviceName) return;
    
    try {
      const response = await fetch(`/api/filenames?vendor=${encodeURIComponent(vendorName)}&service=${encodeURIComponent(serviceName)}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        const fileKey = `${vendorName}-${serviceName}`;
        setUploadedFiles(prev => ({
          ...prev,
          [fileKey]: {
            fileName: result.data.filename,
            vendor: result.data.vendor,
            service: result.data.service
          }
        }));
      }
    } catch (error) {
      console.error("Failed to fetch filename:", error);
    }
  };

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
      // Also fetch the filename for this vendor-service combination
      fetchFilename(selectedVendorName, selectedServiceName);
    }
  }, [selectedVendorName, selectedServiceName]);

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
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4 mt-10"
    >
      <Card className="bg-white border shadow-sm rounded-2xl">
        <CardContent className="p-8 space-y-8">
          <h1 className="text-2xl font-semibold text-primary text-center">
            Manage Rate List
          </h1>

                     {/* Vendor + Search row */}
           <div className="flex flex-col gap-4">
             <div className="flex flex-col md:flex-row gap-2 w-full">
                              {/* Select Vendor */}
                <div className="space-y-1.5 w-full md:w-48">
                  <Select
                    onValueChange={(vendorId) => {
                      const vendor = vendors.find((v) => v.id === vendorId);
                      setSelectedVendor(vendorId);
                      setSelectedVendorName(vendor?.name || "");
                      setSearch("");
                      setCurrentPage(1);
                    }}
                    value={selectedVendor}
                  >
                    <SelectTrigger className="text-sm w-48 h-9">
                      <SelectValue placeholder="Choose a Vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((v) => (
                        <SelectItem key={v.id} value={v.id} className="text-sm">
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Select Service */}
                <div className="space-y-1.5 w-full md:w-48">
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
                    <SelectTrigger className="text-sm w-48 h-9">
                      <SelectValue placeholder="Choose a Service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id} className="text-sm">
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                              {/* Search input */}
                <div className="space-y-1.5 w-full md:w-[240px]">
                  <div className="flex w-full">
                    <Input
                      id="search"
                      placeholder="Search by zone, weight, price, or doc type..."
                      className="h-9 text-sm rounded-r-none"
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
             <div className="flex flex-col md:flex-row gap-2 items-start md:items-center">
               <label
                 htmlFor="file"
                 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                         className="inline-flex items-center px-3 py-2 bg-green-100 text-green-800 text-sm font-medium rounded border border-green-300 hover:bg-green-200 transition cursor-pointer max-w-full break-all"
                       >
                         {currentFileInfo.fileName}
                       </button>
                     </div>
                   ) : null;
                 })()}
               
               <Button
                 onClick={handleDeleteRates}
                 disabled={!selectedVendorName || !selectedServiceName}
                 className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="space-y-4"
            >
              <div className="overflow-auto">
                <table className="min-w-full bg-white text-sm border rounded shadow">
                  <thead className="bg-gray-100 text-left">
                    <tr>
                      <th className="px-4 py-2 border w-24">Zone</th>
                      <th className="px-4 py-2 border w-32">Weight (kg)</th>
                      <th className="px-4 py-2 border w-32">Price</th>
                      <th className="px-4 py-2 border w-32">Service</th>
                      <th className="px-4 py-2 border w-32">Doc Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((rate, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 border">{rate.zone}</td>
                        <td className="px-4 py-2 border">{rate.weight}</td>
                        <td className="px-4 py-2 border">{rate.price}</td>
                        <td className="px-4 py-2 border">{rate.service}</td>
                        <td className="px-4 py-2 border">{rate.docType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing {((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, total)} of {total} results
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
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
              <p className="mt-2 text-gray-600">Loading rates...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && rates?.length === 0 && selectedServiceName && selectedVendorName && (
            <p className="text-center text-gray-500 mt-4">
              No rates found for {selectedVendorName} - {selectedServiceName}.
            </p>
          )}

          {/* No service selected */}
          {!selectedServiceName && (
            <p className="text-center text-gray-500 mt-4">
              Please select a service to view rates.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManageRateListPage;
