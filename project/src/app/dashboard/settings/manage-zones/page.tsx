"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Paperclip, Search } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ManageZonesPage = () => {
  const [selectedService, setSelectedService] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedService') || "";
    }
    return "";
  });
  const [selectedServiceName, setSelectedServiceName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedServiceName') || "";
    }
    return "";
  });
  const [zones, setZones] = useState<any[] | null>(null);
  const [filteredZones, setFilteredZones] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [formattedTime, setFormattedTime] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [courierCompanies, setCourierCompanies] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  // Fetch services on mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setIsLoadingCompanies(true);
        const res = await fetch("/api/settings/serviceMode");
        const data = await res.json();
        setCourierCompanies(data || []);
        
        // If we have a selected service ID but no name, try to find the name
        if (selectedService && !selectedServiceName) {
          const company = data?.find((c: any) => c.id === selectedService);
          if (company) {
            setSelectedServiceName(company.name);
          }
        }
      } catch (error) {
        console.error("Failed to fetch service modes", error);
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    fetchServices();
  }, [selectedService, selectedServiceName]);

  // Upload Excel
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedServiceName) {
      toast.error("Please select a service and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("service", selectedServiceName); // Send name, not ID

    const res = await fetch("/api/zones", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      toast.success("Zone list uploaded successfully!");
      fetchZones(selectedServiceName);
    } else {
      toast.error(result.message || "Upload failed");
    }
  };

  // Fetch zones by company name
  const fetchZones = async (serviceName: string) => {
    const res = await fetch(
      `/api/zones?service=${encodeURIComponent(serviceName)}`
    );

    const result = await res.json();
    if (result.success) {
      const time = result.data[0].uploadedAt.replace(/Z$/, ''); // Remove trailing Z
      const formattedTime = new Date(time).toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi', // optional but safe
        hour12: true,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      console.log("formattedTime", formattedTime);
      setZones(result.data);
      setFilteredZones(result.data);
      // Store formatted time in state for use throughout component
      setFormattedTime(formattedTime);
    } else {
      setZones([]);
      setFilteredZones([]);
      setFormattedTime('');
    }
  };

  // Refetch zones when company changes
  useEffect(() => {
    if (selectedServiceName) {
      fetchZones(selectedServiceName);
    }
  }, [selectedServiceName]);

  // Save selected service to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedService) {
        localStorage.setItem('selectedService', selectedService);
      } else {
        localStorage.removeItem('selectedService');
      }
    }
  }, [selectedService]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (selectedServiceName) {
        localStorage.setItem('selectedServiceName', selectedServiceName);
      } else {
        localStorage.removeItem('selectedServiceName');
      }
    }
  }, [selectedServiceName]);

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

  // Filter zones by search
  useEffect(() => {
    if (!search) {
      const sortedData = sortData(zones || []);
      setFilteredZones(sortedData);
    } else {
      const term = search.toLowerCase();
      const filtered = zones?.filter(
        (z) =>
          z.zone?.toLowerCase().includes(term) ||
          z.country?.toLowerCase().includes(term) ||
          z.code?.toLowerCase().includes(term) ||
          z.phoneCode?.toLowerCase().includes(term)
      );
      const sortedData = sortData(filtered || []);
      setFilteredZones(sortedData);
    }
  }, [search, zones, sortConfig]);

  // Download file function
  const handleDownload = async (filename: string) => {
    if (!filename || filename === 'Unknown') {
      toast.error("No file available for download");
      return;
    }

    try {
      const response = await fetch(`/api/download-file?filename=${encodeURIComponent(filename)}&service=${encodeURIComponent(selectedServiceName)}`);
      
      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("File downloaded successfully!");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
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
            Manage Company Zones
          </h1>

          {/* Service Info */}
          {selectedServiceName && zones && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {selectedServiceName}
                  </h2>
                                     <p className="text-sm text-blue-700 dark:text-blue-300">
                     {zones.length} countries • {filteredZones?.length || zones.length} displayed
                   </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {zones.length}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Total Countries
                  </div>
                </div>
              </div>
              
              {/* Zone Statistics */}
              {zones.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {new Set(zones.map(z => z.zone)).size}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        Unique Zones
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {zones.filter(z => z.phoneCode && z.phoneCode !== "").length}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        With Phone Codes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {zones.filter(z => z.code && z.code !== "").length}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        With Country Codes
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {Math.max(...zones.map(z => parseInt(z.zone.replace(/\D/g, '') || '0')))}
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400">
                        Highest Zone
                      </div>
                    </div>
                  </div>
                  
                                     {/* Last Updated Info */}
                   <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <div className="text-sm text-blue-700 dark:text-blue-300">
                           📄 File:
                         </div>
                         <div 
                           className="text-sm font-medium text-blue-900 dark:text-blue-100 cursor-pointer hover:underline"
                           onClick={() => handleDownload(zones[0]?.filename)}
                           title="Click to download file"
                         >
                           {zones[0]?.filename || 'Unknown'}
                         </div>
                       </div>
                       <div className="flex items-center gap-2">
                         <div className="text-sm text-blue-700 dark:text-blue-300">
                           📅 Last updated:
                         </div>
                         <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                                       {formattedTime}
                         </div>
                       </div>
                     </div>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* Company + Search row */}
          <div className="flex flex-col md:flex-row items-end justify-between gap-4">
            {/* Select + Search Side by Side */}
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              {/* Select Company */}
              <div className="space-y-1.5 w-full md:w-60">
                                 <Select
                   onValueChange={(serviceId) => {
                     const company = courierCompanies.find(
                       (c) => c.id === serviceId
                     );
                     setSelectedService(serviceId);
                     setSelectedServiceName(company?.name || "");
                     setSearch("");
                   }}
                   value={selectedService}
                   disabled={isLoadingCompanies}
                 >
                   <SelectTrigger className="text-sm w-60 h-9">
                     <SelectValue placeholder={isLoadingCompanies ? "Loading..." : "Choose a Service"} />
                   </SelectTrigger>
                  <SelectContent>
                    {courierCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-sm">
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search input with icon */}
              <div className="space-y-1.5 w-full md:w-[320px]">
                <div className="flex w-full">
                  <Input
                    id="search"
                    placeholder="e.g. Zone 3, Ireland, IE, +353"
                    className="h-9 text-sm rounded-r-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={!zones}
                  />
                  <div className="flex items-center justify-center px-3 bg-blue-600 text-white rounded-r-md">
                    <Search className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex justify-end">
              <label
                htmlFor="file"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-blue-700 transition"
              >
                <Paperclip className="w-4 h-4" />
                Upload Excel file
              </label>
              <input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={!selectedServiceName}
                className="hidden"
              />
            </div>
          </div>

          {/* Table */}
          {filteredZones && filteredZones.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-auto mt-6"
            >
              <div className="flex items-center justify-between mb-3">
                                 <div>
                   <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                     Zone Details
                   </h3>
                 </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {filteredZones.length} of {zones?.length || 0} countries
                </div>
              </div>
                             <table className="min-w-full bg-white text-sm border rounded shadow">
                 <thead className="bg-gray-100 text-left">
                   <tr>
                     <th 
                       className="px-4 py-2 border w-24 cursor-pointer hover:bg-gray-200 select-none"
                       onClick={() => handleSort('code')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Code</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'code' && sortConfig?.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'code' && sortConfig?.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                     <th 
                       className="px-4 py-2 border w-64 cursor-pointer hover:bg-gray-200 select-none"
                       onClick={() => handleSort('country')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Country</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'country' && sortConfig?.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'country' && sortConfig?.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                     <th 
                       className="px-4 py-2 border w-32 cursor-pointer hover:bg-gray-200 select-none"
                       onClick={() => handleSort('phoneCode')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Phone Code</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'phoneCode' && sortConfig?.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'phoneCode' && sortConfig?.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                     <th 
                       className="px-4 py-2 border w-40 cursor-pointer hover:bg-gray-200 select-none"
                       onClick={() => handleSort('zone')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Zone</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'zone' && sortConfig?.direction === 'asc' ? 'text-blue-600' : 'text-gray-400'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'zone' && sortConfig?.direction === 'desc' ? 'text-blue-600' : 'text-gray-400'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                   </tr>
                 </thead>
                <tbody>
                  {filteredZones.map((zone, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border w-24">{zone.code}</td>
                      <td className="px-4 py-2 border w-64">{zone.country}</td>
                      <td className="px-4 py-2 border w-32">{zone.phoneCode || "-"}</td>
                      <td className="px-4 py-2 border w-40">{zone.zone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {zones?.length === 0 && (
            <p className="text-center text-gray-500 mt-4">
              No zones found for selected company.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManageZonesPage;
