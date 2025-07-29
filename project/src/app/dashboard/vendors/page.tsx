"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const VendorsPage = () => {
  const [form, setForm] = useState({
    Company: "",
    Address: "",
    City: "",
    Country: "",
    Contact: "",
    Email: "",
    ActiveStatus: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/add-vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Vendor added successfully!");
      setForm({
        Company: "",
        Address: "",
        City: "",
        Country: "",
        Contact: "",
        Email: "",
        ActiveStatus: "",
      });
    } else {
      toast.error(data.message);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4"
    >
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <Card className="w-full border border-gray-200 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-center text-primary">
              Add Vendor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="space-y-1.5">
                <Label htmlFor="Company">Vendor Name</Label>
                <Input
                  id="Company"
                  name="Company"
                  type="text"
                  value={form.Company}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="Address">Address</Label>
                <Input
                  id="Address"
                  name="Address"
                  type="text"
                  value={form.Address}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="City">City</Label>
                <Input
                  id="City"
                  name="City"
                  type="text"
                  value={form.City}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="Country">Country</Label>
                <Input
                  id="Country"
                  name="Country"
                  type="text"
                  value={form.Country}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="Contact">Contact</Label>
                <Input
                  id="Contact"
                  name="Contact"
                  type="text"
                  value={form.Contact}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="Email">Email</Label>
                <Input
                  id="Email"
                  name="Email"
                  type="email"
                  value={form.Email}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ActiveStatus">Active Status</Label>
                <Select
                  value={form.ActiveStatus}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, ActiveStatus: value }))
                  }
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-6 text-sm"
                >
                  Cancel
                </Button>
                <Button type="submit" className="h-10 px-6 text-sm">
                  Add Vendor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default VendorsPage;
