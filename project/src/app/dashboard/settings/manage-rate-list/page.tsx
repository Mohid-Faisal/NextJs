"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ManageRatesPage = () => {
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [rates, setRates] = useState<any[] | null>(null);
  const [courierCompanies, setCourierCompanies] = useState<
    { id: string; name: string }[]
  >([]);

  const fetchRates = async (companyId: string) => {
    const res = await fetch(`/api/rates?company=${companyId}`);
    const result = await res.json();
    if (result.success) {
      setRates(result.data);
    } else {
      setRates([]);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedCompany) {
      toast.error("Please select a company and upload a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("company", selectedCompany);

    const res = await fetch("/api/rates", {
      method: "POST",
      body: formData,
    });

    const result = await res.json();
    if (result.success) {
      toast.success("Rate list uploaded successfully!");
      fetchRates(selectedCompany);
    } else {
      toast.error(result.message || "Upload failed");
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch("/api/settings/courierCompany");
      const data = await res.json();
      setCourierCompanies(data);
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      fetchRates(selectedCompany);
    }
  }, [selectedCompany]);

  const selectedCompanyName =
    courierCompanies.find((c) => c.id === selectedCompany)?.name || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-4 mt-10"
    >
      <Card className="bg-white border shadow-sm rounded-2xl">
        <CardContent className="p-8 space-y-8">
          <h1 className="text-2xl font-semibold text-primary text-center">
            Manage Rate List
          </h1>

          <div className="grid md:grid-cols-2 gap-6 items-end">
            {/* Select Company */}
            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="company">Select Company</Label>
              <Select
                onValueChange={(val) => setSelectedCompany(val)}
                value={selectedCompany}
              >
                <SelectTrigger className="w-2xs text-sm h-9">
                  <SelectValue placeholder="Choose a company" />
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

            {/* Upload Button aligned right */}
            <div className="flex flex-col items-end space-y-1.5">
              {/* Hidden file input */}
              <input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUpload}
                disabled={!selectedCompany}
                className="hidden"
              />

              {/* Visible button triggers input */}
              <label htmlFor="file">
                <Button
                  type="button"
                  disabled={!selectedCompany}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <Paperclip className="w-4 h-4" />
                  Upload Excel File
                </Button>
              </label>
            </div>
          </div>
          {rates && (
            <div className="mt-8">
              <h2 className="text-lg font-medium mb-2">
                Rate List for {selectedCompanyName}
              </h2>
              <pre className="bg-gray-100 p-4 rounded max-h-[400px] overflow-auto text-sm">
                {JSON.stringify(rates, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ManageRatesPage;
