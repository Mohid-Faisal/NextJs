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
import { Trash2, Edit3, Save, X } from "lucide-react";

const settingTypes = [
  "deliveryTime",
  "invoiceStatus",
  "deliveryStatus",
  "shippingMode",
  "packagingType",
  "serviceMode",
  "vendorService",
  "agencies",
  "offices",
];

function formatLabel(label: string) {
  if (label === "vendorService") {
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
  
  // Inline editing states
  const [editingItem, setEditingItem] = useState<{ id: string; type: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOptions = async () => {
    const all: any = {};
    for (const type of settingTypes) {
      if (type === "vendorService") {
        const res = await fetch(`/api/settings/${type}`);
        all[type] = await res.json();
      } else if (type === "agencies") {
        const res = await fetch(`/api/agencies`);
        all[type] = await res.json();
      } else if (type === "offices") {
        const res = await fetch(`/api/offices`);
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
    if (currentTab === "vendorService") {
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
    } else if (currentTab === "agencies" || currentTab === "offices") {
      const code = newValues[`${currentTab}Code`]?.trim();
      const name = newValues[`${currentTab}Name`]?.trim();
      
      if (!code || !name) {
        toast.error("Please enter both code and name");
        return;
      }

      const res = await fetch(`/api/${currentTab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name }),
      });

      if (res.ok) {
        toast.success(`${currentTab === "agencies" ? "Agency" : "Office"} added successfully!`);
        setNewValues((prev) => ({ 
          ...prev, 
          [`${currentTab}Code`]: "",
          [`${currentTab}Name`]: "" 
        }));
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
    let endpoint = `/api/settings/${currentTab}?id=${id}`;
    
    if (currentTab === "agencies") {
      endpoint = `/api/agencies/${id}`;
    } else if (currentTab === "offices") {
      endpoint = `/api/offices/${id}`;
    }

    const res = await fetch(endpoint, {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("Deleted successfully!");
      fetchOptions();
    } else {
      toast.error("Failed to delete.");
    }
  };

  // Inline editing functions
  const startEditing = (id: string, type: string, currentValue: string) => {
    setEditingItem({ id, type });
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingItem(null);
    setEditValue("");
  };

  const saveEdit = async () => {
    if (!editingItem || !editValue.trim()) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsUpdating(true);
    try {
      let endpoint = `/api/settings/${editingItem.type}`;
      let body: any = {
        id: editingItem.id,
        name: editValue.trim(),
      };

      if (editingItem.type === "agencies") {
        endpoint = `/api/agencies/${editingItem.id}`;
        body = {
          code: editValue.trim(),
          name: editValue.trim(),
        };
      } else if (editingItem.type === "offices") {
        endpoint = `/api/offices/${editingItem.id}`;
        body = {
          code: editValue.trim(),
          name: editValue.trim(),
        };
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        toast.success("Updated successfully!");
        setEditingItem(null);
        setEditValue("");
        fetchOptions();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update");
      }
    } catch (error) {
      toast.error("Failed to update");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const EditableItem = ({ 
    item, 
    type 
  }: { 
    item: any; 
    type: string; 
  }) => {
    const isEditing = editingItem?.id === item.id && editingItem?.type === type;
    let displayValue = item.name || "Not specified";
    
    // For agencies and offices, show both code and name
    if (type === "agencies" || type === "offices") {
      displayValue = `${item.code} - ${item.name}`;
    }

    if (isEditing) {
      return (
        <li className="flex justify-between items-center border px-4 py-2 rounded shadow-sm">
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1"
              autoFocus
              placeholder="Enter value"
            />
            <Button
              size="sm"
              onClick={saveEdit}
              disabled={isUpdating}
              className="h-8 px-2"
            >
              <Save className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelEditing}
              className="h-8 px-2"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </li>
      );
    }

    return (
      <li className="flex justify-between items-center border px-4 py-2 rounded shadow-sm group hover:bg-gray-50 transition-colors">
        <span className="font-medium">{displayValue}</span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startEditing(item.id, type, type === "agencies" || type === "offices" ? item.code || "" : item.name || "")}
            className="h-8 w-8"
          >
            <Edit3 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(item.id)}
            className="h-8 w-8"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </li>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <Card className="shadow-xl border rounded-lg">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Shipment Settings</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6">
          <Tabs defaultValue={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="flex flex-wrap justify-center gap-2 mb-4 sm:mb-6 p-1">
              {settingTypes.map((type) => (
                <TabsTrigger key={type} value={type} className="min-w-[110px] text-center text-xs sm:text-sm">
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
                {type === "vendorService" ? (
                  // Vendor Service Tab
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
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
                      
                      <Button onClick={handleAdd} className="w-full md:w-auto">Add Vendor Service</Button>
                    </div>

                    {options[type]?.length > 0 ? (
                      <ul className="space-y-3">
                        {(() => {
                          // Group vendor services by vendor
                          const groupedVendors: Record<string, any[]> = {};
                          options[type].forEach((item: any) => {
                            if (!groupedVendors[item.vendor]) {
                              groupedVendors[item.vendor] = [];
                            }
                            groupedVendors[item.vendor].push(item);
                          });

                          return Object.entries(groupedVendors).map(([vendor, services]) => (
                            <li
                              key={vendor}
                              className="flex justify-between items-center border px-4 py-3 rounded shadow-sm"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-lg">{vendor}</span>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {services.map((service) => (
                                    <span
                                      key={service.id}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                                    >
                                      {service.service}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(service.id)}
                                        className="h-4 w-4 p-0 ml-1 hover:bg-blue-200"
                                      >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                      </Button>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </li>
                          ));
                        })()}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No vendor services yet.</p>
                    )}
                  </>
                ) : type === "agencies" || type === "offices" ? (
                  // Agencies and Offices Tab
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                      <Input
                        placeholder={`${type === "agencies" ? "Agency" : "Office"} Code`}
                        value={newValues[`${type}Code`] || ""}
                        onChange={(e) =>
                          setNewValues((prev) => ({
                            ...prev,
                            [`${type}Code`]: e.target.value,
                          }))
                        }
                        className="w-full md:w-auto"
                      />
                      <Input
                        placeholder={`${type === "agencies" ? "Agency" : "Office"} Name`}
                        value={newValues[`${type}Name`] || ""}
                        onChange={(e) =>
                          setNewValues((prev) => ({
                            ...prev,
                            [`${type}Name`]: e.target.value,
                          }))
                        }
                        className="w-full md:w-auto"
                      />
                      <Button onClick={handleAdd} className="w-full md:w-auto">Add {type === "agencies" ? "Agency" : "Office"}</Button>
                    </div>

                    {options[type]?.length > 0 ? (
                      <ul className="space-y-3">
                        {options[type].map((item: any) => (
                          <EditableItem
                            key={item.id}
                            item={item}
                            type={type}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">No {type === "agencies" ? "agencies" : "offices"} yet.</p>
                    )}
                  </>
                ) : (
                  // Regular Settings Tab
                  <>
                    <div className="flex flex-col md:flex-row items-start md:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
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
                      <Button onClick={handleAdd} className="w-full md:w-auto">Add</Button>
                    </div>

                    {options[type]?.length > 0 ? (
                      <ul className="space-y-3">
                        {options[type].map((item: any) => (
                          <EditableItem
                            key={item.id}
                            item={item}
                            type={type}
                          />
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
    </div>
  );
}
