// components/AddCustomerDialog.tsx

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const AddCustomerDialog = ({ triggerLabel = "Add Customer" }: { triggerLabel?: string }) => {
  const [form, setForm] = useState<{
    Company: string;
    Address: string;
    City: string;
    Country: string;
    Contact: string;
    Email: string;
    ActiveStatus: string;
    SpecialInstructions: string;
  }>({
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

  const handleCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/add-customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Customer added successfully!");
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl text-center mb-4">Add Customer</DialogTitle>
          </DialogHeader>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {[
              ["Company", "Company Name"],
              ["Address", "Address"],
              ["City", "City"],
              ["Country", "Country"],
              ["Contact", "Contact"],
              ["Email", "Email"],
              ["SpecialInstructions", "Special Instructions"],
            ].map(([field, label]) => (
              <div className="space-y-1" key={field}>
                <Label htmlFor={field}>{label}</Label>
                <Input
                  id={field}
                  name={field}
                  type={field === "Email" ? "email" : "text"}
                  value={(form as any)[field]}
                  onChange={handleChange}
                  required={field !== "SpecialInstructions"}
                  placeholder={label}
                  className="text-sm"
                />
              </div>
            ))}
            {/* Active Status as Select */}
            <div className="space-y-1">
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
            <div className="col-span-1 md:col-span-2 flex justify-end gap-2 pt-4">
              <Button type="reset" variant="ghost" className="text-sm px-4">
                Cancel
              </Button>
              <Button type="button" onClick={handleCustomer} className="text-sm px-4">
                Add Customer
              </Button>
            </div>
          </form>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomerDialog;
