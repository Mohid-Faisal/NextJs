"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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

const RecipientsPage = () => {
  const [form, setForm] = useState({
    Company: "",
    Address: "",
    City: "",
    Country: "",
    Contact: "",
    Email: "",
    ActiveStatus: "",
    SpecialInstructions: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(form);
    const res = await fetch("/api/add-recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Recipient added successfully!");
      setForm({
        Company: "",
        Address: "",
        City: "",
        Country: "",
        Contact: "",
        Email: "",
        ActiveStatus: "",
        SpecialInstructions: "",
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
        <Card className="w-full border border-gray-100 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-6 md:p-8">
            <h1 className="text-2xl font-semibold mb-8 text-center text-primary">
              Add Recipient
            </h1>
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
            >
              {/* Company */}
              <div className="space-y-1">
                <Label htmlFor="Company">Company Name</Label>
                <Input
                  id="Company"
                  name="Company"
                  value={form.Company}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>

              {/* Address */}
              <div className="space-y-1">
                <Label htmlFor="Address">Address</Label>
                <Input
                  id="Address"
                  name="Address"
                  value={form.Address}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>

              {/* City */}
              <div className="space-y-1">
                <Label htmlFor="City">City</Label>
                <Input
                  id="City"
                  name="City"
                  value={form.City}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>

              {/* Country */}
              <div className="space-y-1">
                <Label htmlFor="Country">Country</Label>
                <Input
                  id="Country"
                  name="Country"
                  value={form.Country}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>

              {/* Contact */}
              <div className="space-y-1">
                <Label htmlFor="Contact">Contact</Label>
                <Input
                  id="Contact"
                  name="Contact"
                  value={form.Contact}
                  onChange={handleChange}
                  required
                  className="text-sm"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
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

              {/* Active Status */}
              <div className="space-y-1">
                <Label htmlFor="ActiveStatus">Active Status</Label>
                <Select
                  value={form.ActiveStatus}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, ActiveStatus: value }))
                  }
                  required
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Special Instructions */}
              <div className="space-y-1">
                <Label htmlFor="SpecialInstructions">
                  Special Instructions
                </Label>
                <Input
                  id="SpecialInstructions"
                  name="SpecialInstructions"
                  value={form.SpecialInstructions}
                  onChange={handleChange}
                  placeholder="Any special instructions..."
                  className="text-sm"
                />
              </div>

              {/* Buttons */}
              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-sm px-6 rounded-xl"
                >
                  Cancel
                </Button>
                <Button type="submit" className="text-sm px-6 rounded-xl">
                  Add Recipient
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default RecipientsPage;
