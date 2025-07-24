"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UpdateShipmentPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [shipment, setShipment] = useState<any>(null);
  const [form, setForm] = useState({
    trackingId: "",
    senderName: "",
    recipientName: "",
    destination: "",
    paymentMethod: "",
    totalCost: "",
    status: "",
    invoiceStatus: "",
  });

  const handleSearch = async () => {
    if (!searchTerm) return;

    const res = await fetch(`/api/shipments?search=${searchTerm}`);
    const { shipments } = await res.json();
    // console.log(shipments);
    if (shipments.length > 0) {
      const s = shipments[0];
      setShipment(s);
      setForm({
        trackingId: s.trackingId || "",
        senderName: s.senderName || "",
        recipientName: s.recipientName || "",
        destination: s.destination || "",
        paymentMethod: s.paymentMethod || "",
        totalCost: s.totalCost || "",
        status: s.status || "",
        invoiceStatus: s.invoiceStatus || "",
      });
    } else {
      toast.error("Shipment not found");
      setShipment(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSelect = (name: string, value: string) => {
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment?.id) return;

    // Remove empty fields
    const payload: Record<string, any> = {};
    Object.entries(form).forEach(([key, value]) => {
      if (value !== "") {
        payload[key] = value;
      }
    });

    const res = await fetch(`/api/update-shipment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: shipment.id, ...payload }),
    });

    const data = await res.json();
    if (data.success) {
      toast.success("Shipment updated successfully!");
    } else {
      toast.error(data.message || "Update failed.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto px-4"
    >
      <Card className="w-full shadow-md">
        <CardContent className="p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">
            Update Shipment
          </h1>

          {/* Search Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <Input
              placeholder="Search by Tracking ID, Sender, or Receiver"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button onClick={handleSearch}>Search</Button>
          </div>

          {shipment && (
            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {[ 
                { label: "Tracking ID", name: "trackingId" },
                { label: "Destination", name: "destination" },
                { label: "Sender Name", name: "senderName" },
                { label: "Recipient Name", name: "recipientName" },
                { label: "Total Cost", name: "totalCost", type: "number" },
              ].map((field) => (
                <div key={field.name} className="flex flex-col space-y-2">
                  <Label htmlFor={field.name}>{field.label}</Label>
                  <Input
                    id={field.name}
                    name={field.name}
                    type={field.type || "text"}
                    value={(form as any)[field.name]}
                    onChange={handleChange}
                    className="w-full"
                  />
                </div>
              ))}

              {/* Payment Method */}
              <div className="flex flex-col space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(val) => handleSelect("paymentMethod", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(val) => handleSelect("status", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice Status */}
              <div className="flex flex-col space-y-2">
                <Label>Invoice Status</Label>
                <Select
                  value={form.invoiceStatus}
                  onValueChange={(val) => handleSelect("invoiceStatus", val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select invoice status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unpaid">Unpaid</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Button type="submit" className="w-full mt-4">
                  Update Shipment
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default UpdateShipmentPage;
