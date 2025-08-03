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
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [zones, setZones] = useState<any[] | null>(null);
  const [filteredZones, setFilteredZones] = useState<any[] | null>(null);
  const [search, setSearch] = useState("");
  const [courierCompanies, setCourierCompanies] = useState<
    { id: string; name: string }[]
  >([]);

  // Fetch services on mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch("/api/settings/serviceMode");
        const data = await res.json();
        setCourierCompanies(data || []);
      } catch (error) {
        console.error("Failed to fetch service modes", error);
      }
    };
    fetchServices();
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
      setZones(result.data);
      setFilteredZones(result.data);
    } else {
      setZones([]);
      setFilteredZones([]);
    }
  };

  // Refetch zones when company changes
  useEffect(() => {
    if (selectedServiceName) {
      fetchZones(selectedServiceName);
    }
  }, [selectedServiceName]);

  // Filter zones by search
  useEffect(() => {
    if (!search) {
      setFilteredZones(zones);
    } else {
      const term = search.toLowerCase();
      const filtered = zones?.filter(
        (z) =>
          z.zone?.toLowerCase().includes(term) ||
          z.country?.toLowerCase().includes(term) ||
          z.code?.toLowerCase().includes(term)
      );
      setFilteredZones(filtered || []);
    }
  }, [search, zones]);

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
                >
                  <SelectTrigger className="text-sm w-60 h-9">
                    <SelectValue placeholder="Choose a Service" />
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
                    placeholder="e.g. Zone 3, Ireland, IE"
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
              <table className="min-w-full bg-white text-sm border rounded shadow">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="px-4 py-2 border w-24">Code</th>{" "}
                    {/* Fixed width 96px */}
                    <th className="px-4 py-2 border w-64">Country</th>{" "}
                    {/* Fixed width 256px */}
                    <th className="px-4 py-2 border w-40">Zone</th>{" "}
                    {/* Fixed width 160px */}
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((zone, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border w-24">{zone.code}</td>
                      <td className="px-4 py-2 border w-64">{zone.country}</td>
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
