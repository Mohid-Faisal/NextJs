"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, Search, Trash2, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const ManageZonesPage = () => {
  const router = useRouter();
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [zones, setZones] = useState<any[] | null>(null);
  const [filteredZones, setFilteredZones] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [formattedTime, setFormattedTime] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [serviceModes, setServiceModes] = useState<
    { id: string; name: string }[]
  >([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [availableZones, setAvailableZones] = useState<{[key: string]: {filename: string, uploadedAt: string}}>({});

  // Fetch services and available zones on mount
  useEffect(() => {
    const fetchServicesAndZones = async () => {
      try {
        setIsLoadingServices(true);
        
        // Fetch services
        const servicesRes = await fetch("/api/settings/serviceMode");
        const servicesData = await servicesRes.json();
        setServiceModes(servicesData || []);
        
        // Fetch available zones
        const zonesRes = await fetch("/api/zones/available");
        const zonesData = await zonesRes.json();

                 if (zonesData.success) {
           const zonesMap: {[key: string]: {filename: string, uploadedAt: string}} = {};
           zonesData.data.forEach((zone: any) => {
             // Convert service name to lowercase for case-insensitive matching
             const serviceKey = zone.service.toLowerCase();
             zonesMap[serviceKey] = {
               filename: zone.filename,
               uploadedAt: zone.uploadedAt
             };
           });
           console.log("zonesMap", zonesMap);
           console.log("serviceModes", servicesData);
           setAvailableZones(zonesMap);
         }
      } catch (error) {
        console.error("Failed to fetch services and zones", error);
      } finally {
        setIsLoadingServices(false);
      }
    };
    fetchServicesAndZones();
  }, []);

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
      
             // Update available zones
       const updatedZones = { ...availableZones };
       updatedZones[selectedServiceName.toLowerCase()] = {
         filename: result.filename || file.name,
         uploadedAt: new Date().toISOString()
       };
       setAvailableZones(updatedZones);
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

  // Delete zones function
  const handleDelete = async () => {
    if (!selectedServiceName) {
      toast.error("Please select a service first");
      return;
    }

    if (!confirm(`Are you sure you want to delete all zone data for "${selectedServiceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/zones?service=${encodeURIComponent(selectedServiceName)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success(`All zone data for "${selectedServiceName}" has been deleted successfully!`);
        setZones([]);
        setFilteredZones([]);
        setFormattedTime('');
        setSearch('');
        
                 // Remove from available zones
         const updatedZones = { ...availableZones };
         delete updatedZones[selectedServiceName.toLowerCase()];
         setAvailableZones(updatedZones);
      } else {
        toast.error(result.message || "Failed to delete zone data");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete zone data");
    }
  };

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
      {/* Back Button */}
      <div className="mb-6">
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
                                        const service = serviceModes.find(
                     (s) => s.id === serviceId
                   );
                     setSelectedService(serviceId);
                     setSelectedServiceName(service?.name || "");
                     setSearch("");
                   }}
                   value={selectedService}
                   disabled={isLoadingServices}
                 >
                   <SelectTrigger className="text-sm w-60 h-9">
                     <SelectValue placeholder={isLoadingServices ? "Loading..." : "Choose a Service"} />
                   </SelectTrigger>
                  <SelectContent>
                    {serviceModes.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-sm">
                        {s.name}
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

                         {/* Action Buttons */}
             <div className="flex justify-end gap-2">
               <button
                 onClick={handleDelete}
                 disabled={!selectedServiceName || !zones || zones.length === 0}
                 className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md cursor-pointer hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                 title="Delete all zone data for selected service"
               >
                 <Trash2 className="w-4 h-4" />
                 Delete All
               </button>
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
                             <table className="min-w-full bg-white dark:bg-gray-800 text-sm border rounded shadow">
                 <thead className="bg-gray-100 dark:bg-gray-700 text-left">
                   <tr>
                     <th 
                       className="px-4 py-2 border w-24 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                       onClick={() => handleSort('code')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Code</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'code' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'code' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                     <th 
                       className="px-4 py-2 border w-64 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
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
                       className="px-4 py-2 border w-40 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                       onClick={() => handleSort('zone')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Zone</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'zone' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'zone' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                     <th 
                       className="px-4 py-2 border w-32 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 select-none"
                       onClick={() => handleSort('phoneCode')}
                     >
                       <div className="flex items-center justify-between">
                         <span>Phone Code</span>
                         <div className="flex flex-col">
                           <span className={`text-xs ${sortConfig?.key === 'phoneCode' && sortConfig?.direction === 'asc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▲</span>
                           <span className={`text-xs ${sortConfig?.key === 'phoneCode' && sortConfig?.direction === 'desc' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>▼</span>
                         </div>
                       </div>
                     </th>
                   </tr>
                 </thead>
                <tbody>
                  {filteredZones.map((zone, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 border w-24">{zone.code}</td>
                      <td className="px-4 py-2 border w-64">{zone.country}</td>
                      <td className="px-4 py-2 border w-40">{zone.zone}</td>
                      <td className="px-4 py-2 border w-32">{zone.phoneCode || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {zones?.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 mt-4">
              No zones found for selected service.
            </p>
          )}

          {/* Available Zones Section */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Available Zones
            </h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                               {serviceModes.map((service) => {
                  // Check if this service has zones data from the filename table
                  // Use lowercase for case-insensitive matching
                  const hasZones = availableZones[service.name.toLowerCase()];
                  const isSelected = selectedServiceName === service.name;
                 
                 return (
                   <div
                     key={service.id}
                     className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                       hasZones
                         ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900"
                         : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                     } ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                     onClick={() => {
                       setSelectedService(service.id);
                       setSelectedServiceName(service.name);
                       setSearch("");
                     }}
                   >
                     <div className="flex items-center justify-between">
                       <div className="flex-1">
                         <p className={`font-medium text-sm ${
                           hasZones 
                             ? "text-green-800 dark:text-green-200" 
                             : "text-gray-600 dark:text-gray-300"
                         }`}>
                           {service.name}
                         </p>
                         <p className={`text-xs ${
                           hasZones 
                             ? "text-green-600 dark:text-green-300" 
                             : "text-gray-500 dark:text-gray-400"
                         }`}>
                           {hasZones ? "Zones uploaded" : "No zones uploaded"}
                         </p>
                         {hasZones && (
                           <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                             {hasZones.filename}
                           </p>
                         )}
                       </div>
                       <div className={`${
                         hasZones 
                           ? "text-green-600 dark:text-green-400" 
                           : "text-gray-400 dark:text-gray-500"
                       }`}>
                         {hasZones ? (
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                           </svg>
                         ) : (
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                           </svg>
                         )}
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
            
            {serviceModes.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No services available. Please add services first.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManageZonesPage;
