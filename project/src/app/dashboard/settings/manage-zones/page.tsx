"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ManageRateListPage = () => {
  const [selectedService, setSelectedService] = useState<string>("");
  const [selectedServiceName, setSelectedServiceName] = useState<string>("");
  const [rates, setRates] = useState<any[] | null>(null);
  const [filteredRates, setFilteredRates] = useState<any[] | null>(null);
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

    const res = await fetch("/api/rates", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      toast.success("Rate list uploaded successfully!");
      fetchRates(selectedServiceName);
    } else {
      toast.error(result.message || "Upload failed");
    }
  };

  // Fetch rates by company name
  const fetchRates = async (serviceName: string) => {
    const res = await fetch(`/api/rates?service=${encodeURIComponent(serviceName)}`);
    const result = await res.json();
    if (result.success) {
      setRates(result.data);
      setFilteredRates(result.data);
    } else {
      setRates([]);
      setFilteredRates([]);
    }
  };

  // Refetch rates when company changes
  useEffect(() => {
    if (selectedServiceName) {
      fetchRates(selectedServiceName);
    }
  }, [selectedServiceName]);

  // Filter by search
  useEffect(() => {
    if (!search) {
      setFilteredRates(rates);
    } else {
      const term = search.toLowerCase();
      const filtered = rates?.filter(
        (r) =>
          r.zone?.toLowerCase().includes(term) ||
          r.weight?.toString().includes(term) ||
          r.rate?.toString().includes(term)
      );
      setFilteredRates(filtered || []);
    }
  }, [search, rates]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4 mt-10"
    >
      <Card className="bg-white border shadow-sm rounded-2xl">
        <CardContent className="p-8 space-y-8">
          {/* Heading */}
          <h1 className="text-2xl font-semibold text-primary text-center">
            Manage Rate List
          </h1>

          {/* Company + Search row */}
          <div className="flex flex-col md:flex-row items-end justify-between gap-4">
            {/* Select + Search Side by Side */}
            <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
              {/* Select Company */}
              <div className="space-y-1.5 w-full md:w-60">
                <Select
                  onValueChange={(serviceId) => {
                    const company = courierCompanies.find((c) => c.id === serviceId);
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

              {/* Search input */}
              <div className="space-y-1.5 w-full md:w-[320px]">
                <div className="flex w-full">
                  <Input
                    id="search"
                    placeholder="e.g. Zone 3, 0.5kg, 200"
                    className="h-9 text-sm rounded-r-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={!rates}
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
          {filteredRates && filteredRates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-auto mt-6"
            >
              <table className="min-w-full bg-white text-sm border rounded shadow">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="px-4 py-2 border w-24">Zone</th>
                    <th className="px-4 py-2 border w-32">Weight (kg)</th>
                    <th className="px-4 py-2 border w-32">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRates.map((rate, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border w-24">{rate.zone}</td>
                      <td className="px-4 py-2 border w-32">{rate.weight}</td>
                      <td className="px-4 py-2 border w-32">{rate.rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {/* Empty state */}
          {filteredRates?.length === 0 && (
            <p className="text-center text-gray-500 mt-4">
              No rates found for selected company.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManageRateListPage;
