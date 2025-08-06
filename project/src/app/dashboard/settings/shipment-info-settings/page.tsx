"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

const settingTypes = [
  "deliveryTime",
  "paymentMethod",
  "deliveryStatus",
  "shippingMode",
  "packagingType",
  "courierCompany",
  "serviceMode",
  "vendorservice",
];

function formatLabel(label: string) {
  if (label === "vendorservice") {
    return "Vendor Service";
  }
  return label.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
}

export default function ShipmentSettingsPage() {
  const [currentTab, setCurrentTab] = useState("deliveryTime");
  const [options, setOptions] = useState<Record<string, any[]>>({});
  const [newValues, setNewValues] = useState<Record<string, string>>({});
  const [vendors, setVendors] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string>("");

  const fetchOptions = async () => {
    const all: any = {};
    for (const type of settingTypes) {
      if (type === "vendorservice") {
        const res = await fetch(`/api/settings/${type}`);
        all[type] = await res.json();
      } else {
        const res = await fetch(`/api/settings/${type}`);
        all[type] = await res.json();
      }
    }
    setOptions(all);
  };

  const fetchVendors = async () => {
    const res = await fetch("/api/vendors");
    const data = await res.json();
    setVendors(data.vendors || []);
  };

  const fetchServices = async () => {
    // Fetch services from the serviceMode settings
    const res = await fetch("/api/settings/serviceMode");
    const data = await res.json();
    setServices(data || []);
  };

  useEffect(() => {
    fetchOptions();
    fetchVendors();
    fetchServices();
  }, []);

  const handleAdd = async () => {
    if (currentTab === "vendorservice") {
      const vendor = selectedVendor?.trim();
      const service = selectedService?.trim();
      
      if (!vendor || !service) {
        toast.error("Please select both vendor and service");
        return;
      }

      const res = await fetch(`/api/settings/${currentTab}`, {
        method: "POST",
        body: JSON.stringify({ vendor, service }),
      });

      if (res.ok) {
        toast.success("Vendor service added successfully!");
        setSelectedVendor("");
        setSelectedService("");
        fetchOptions();
      } else {
        const error = await res.json();
        toast.error(error.error || "Something went wrong.");
      }
    } else {
      const value = newValues[currentTab]?.trim();
      if (!value) return;

      const res = await fetch(`/api/settings/${currentTab}`, {
        method: "POST",
        body: JSON.stringify({ name: value }),
      });

      if (res.ok) {
        toast.success("Added successfully!");
        setNewValues((prev) => ({ ...prev, [currentTab]: "" }));
        fetchOptions();
      } else {
        toast.error("Something went wrong.");
      }
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/settings/${currentTab}?id=${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Deleted successfully!");
      fetchOptions();
    } else {
      toast.error("Failed to delete.");
    }
  };

  return (
    <Card className="m-4 md:m-8 shadow-xl border rounded-lg">
      <CardHeader>
        <CardTitle className="text-xl">Shipment Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
            {settingTypes.map((type) => (
              <TabsTrigger key={type} value={type}>
                {formatLabel(type)}
              </TabsTrigger>
            ))}
          </TabsList>

          {settingTypes.map((type) => (
            <TabsContent key={type} value={type}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {type === "vendorservice" ? (
                  // Vendor Service Tab
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                      <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                        <SelectTrigger className="w-full md:w-[200px]">
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.CompanyName}>
                              {vendor.CompanyName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select value={selectedService} onValueChange={setSelectedService}>
                        <SelectTrigger className="w-full md:w-[200px]">
                          <SelectValue placeholder="Select service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.name}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Button onClick={handleAdd}>Add Vendor Service</Button>
                    </div>

                    {options[type]?.length > 0 ? (
                      <ul className="space-y-3">
                        {options[type].map((item: any) => (
                          <li
                            key={item.id}
                            className="flex justify-between items-center border px-4 py-2 rounded shadow-sm"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium">{item.vendor}</span>
                              <span className="text-sm text-gray-500">{item.service}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No vendor services yet.</p>
                    )}
                  </>
                ) : (
                  // Regular Settings Tab
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
                      <Input
                        placeholder={`Add new ${formatLabel(type)}`}
                        value={newValues[type] || ""}
                        onChange={(e) =>
                          setNewValues((prev) => ({
                            ...prev,
                            [type]: e.target.value,
                          }))
                        }
                        className="w-full md:w-auto"
                      />
                      <Button onClick={handleAdd}>Add</Button>
                    </div>

                    {options[type]?.length > 0 ? (
                      <ul className="space-y-3">
                        {options[type].map((item: any) => (
                          <li
                            key={item.id}
                            className="flex justify-between items-center border px-4 py-2 rounded shadow-sm"
                          >
                            <span>{item.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No entries yet.</p>
                    )}
                  </>
                )}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
