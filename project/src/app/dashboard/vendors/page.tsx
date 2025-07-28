"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";

const VendorsPage = () => {
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
    // console.log(form);
    const res = await fetch("/api/add-vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    console.log(data);
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
      className="max-w-3xl mx-auto px-2"
    >
      <div className="min-h-[calc(100vh-8rem)] w-full flex items-center justify-center bg-transparent">
        <div className="w-full max-w-3xl">
          <Card className="w-full shadow-none border-none bg-white">
            <CardContent className="p-6">
              <h1 className="text-2xl font-semibold mb-8 text-center text-primary tracking-tight">
                Add Vendor
              </h1>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                <div className="space-y-1">
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
                <div className="space-y-1">
                  <Label htmlFor="ActiveStatus">Active Status</Label>
                  <Input
                    id="ActiveStatus"
                    name="ActiveStatus"
                    type="text"
                    value={form.ActiveStatus}
                    onChange={handleChange}
                    placeholder="Active/Inactive"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="SpecialInstructions">Special Instructions</Label>
                  <Input
                    id="SpecialInstructions"
                    name="SpecialInstructions"
                    type="text"
                    value={form.SpecialInstructions}
                    onChange={handleChange}
                    placeholder="Any special instructions..."
                    className="text-sm"
                  />
                </div>
                <div className="col-span-1 md:col-span-2 flex justify-end gap-2 pt-4">
                  <Button type="button" variant="ghost" className="text-sm px-4">
                    Cancel
                  </Button>
                  <Button type="submit" className="text-sm px-4">
                    Add Vendor
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default VendorsPage;
