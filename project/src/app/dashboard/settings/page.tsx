"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck,
  Plus,
  Trash2,
  Edit3,
  Search,
  Bell,
  CreditCard,
  Check,
  MoreVertical,
  Sliders,
  Building,
  Package,
  Layers,
  Clock,
  Briefcase,
  Hash
} from "lucide-react";

// Left Menu Navigation Tabs
type TabId = "statuses" | "services" | "notifications" | "billing" | "bookingNumbering";

interface TabItem {
  id: TabId;
  label: string;
  description: string;
  icon: any;
}

const tabsList: TabItem[] = [
  { id: "statuses", label: "Shipment Statuses", description: "Manage shipment statuses, icons and colors", icon: Sliders },
  { id: "services", label: "Services", description: "Manage air, land, sea and custom services", icon: Truck },
  { id: "notifications", label: "Notifications", description: "Manage notification rules and templates", icon: Bell },
  { id: "billing", label: "Billing", description: "Manage currency, tax, invoice design", icon: CreditCard },
  { id: "bookingNumbering", label: "Booking Numbers", description: "Prefix, padding and next number for booking numbers", icon: Hash },
];

export default function RedesignedSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("statuses");
  const [loading, setLoading] = useState(true);

  // Search filter states
  const [statusSearch, setStatusSearch] = useState("");
  const [servicesSearch, setServicesSearch] = useState("");

  // Data lists
  const [statuses, setStatuses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>({
    currency: "USD - United States Dollar ($)",
    tax: "0%",
    paymentTerms: "Payment is due upon receipt.",
    invoiceFooter: "Thank you for your business.",
    invoiceDesign: "MODERN PURPLE"
  });

  const [bookingNumbering, setBookingNumbering] = useState<any>({
    prefix: "BK",
    suffix: "",
    padding: 8,
    nextNumber: 1,
    reset: "Never"
  });

  // Services Nested Sub-Tabs
  type ServiceSubTab = "services" | "shippingModes" | "deliveryTimes" | "packagingTypes" | "vendorServices" | "agencies" | "offices";
  const [serviceSubTab, setServiceSubTab] = useState<ServiceSubTab>("services");

  // Other settings data
  const [shippingModes, setShippingModes] = useState<any[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<any[]>([]);
  const [packagingTypes, setPackagingTypes] = useState<any[]>([]);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);

  // Modals / Add new item states
  const [openModal, setOpenModal] = useState<"status" | "service" | "shippingMode" | "deliveryTime" | "packagingType" | "vendorService" | "agency" | "office" | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);

  // Form Fields
  const [statusForm, setStatusForm] = useState({ name: "", code: "", color: "#4F46E5", order: 0, status: "Active" });
  const [serviceForm, setServiceForm] = useState({ name: "", code: "", mode: "Air", currency: "USD", status: "Active" });
  const [genericForm, setGenericForm] = useState({ name: "", code: "" });
  const [vendorSvcForm, setVendorSvcForm] = useState({ vendor: "", service: "" });

  const loadAllSettings = async () => {
    setLoading(true);
    try {
      // 1. Load Statuses
      const statusesRes = await fetch("/api/settings/deliveryStatus");
      if (statusesRes.ok) setStatuses(await statusesRes.json());

      // 2. Load Services
      const servicesRes = await fetch("/api/settings/serviceMode");
      if (servicesRes.ok) setServices(await servicesRes.json());

      // 3. Load Notifications
      const notifRes = await fetch("/api/settings/custom?key=settings_notifications");
      if (notifRes.ok) {
        const d = await notifRes.json();
        if (d.value) setNotifications(JSON.parse(d.value));
      }

      // 4. Load Billing Settings
      const billRes = await fetch("/api/settings/custom?key=settings_billing");
      if (billRes.ok) {
        const d = await billRes.json();
        if (d.value) setBilling(JSON.parse(d.value));
      }

      // 5. Load Other Settings (Sub-tabs)
      const smRes = await fetch("/api/settings/shippingMode");
      if (smRes.ok) setShippingModes(await smRes.json());

      const dtRes = await fetch("/api/settings/deliveryTime");
      if (dtRes.ok) setDeliveryTimes(await dtRes.json());

      const ptRes = await fetch("/api/settings/packagingType");
      if (ptRes.ok) setPackagingTypes(await ptRes.json());

      const vsRes = await fetch("/api/settings/vendorService");
      if (vsRes.ok) setVendorServices(await vsRes.json());

      const vendorListRes = await fetch("/api/vendors");
      if (vendorListRes.ok) {
        const data = await vendorListRes.json();
        setVendors(data.vendors || []);
      }

      const agencyRes = await fetch("/api/agencies");
      if (agencyRes.ok) setAgencies(await agencyRes.json());

      const officeRes = await fetch("/api/offices");
      if (officeRes.ok) setOffices(await officeRes.json());

      // 6. Load Booking Numbering
      const bookingRes = await fetch("/api/settings/custom?key=settings_booking_numbering");
      if (bookingRes.ok) {
        const d = await bookingRes.json();
        if (d.value) setBookingNumbering(JSON.parse(d.value));
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to load settings data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSettings();
  }, []);

  // Generic Save/Update Operations
  const handleSaveStatus = async () => {
    if (!statusForm.name.trim() || !statusForm.code.trim()) {
      toast.error("Please fill in status name and code");
      return;
    }
    try {
      const url = "/api/settings/deliveryStatus";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...statusForm } : statusForm),
      });
      if (res.ok) {
        toast.success(editingId ? "Status updated" : "Status created");
        setOpenModal(null);
        setEditingId(null);
        loadAllSettings();
      } else {
        toast.error("Operation failed");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleSaveService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.code.trim()) {
      toast.error("Please fill in service name and code");
      return;
    }
    try {
      const url = "/api/settings/serviceMode";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...serviceForm } : serviceForm),
      });
      if (res.ok) {
        toast.success(editingId ? "Service updated" : "Service created");
        setOpenModal(null);
        setEditingId(null);
        loadAllSettings();
      } else {
        toast.error("Operation failed");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleSaveGeneric = async (type: string) => {
    if (!genericForm.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      const isAgencyOrOffice = type === "agency" || type === "office";
      const pluralType = type === "agency" ? "agencies" : type === "office" ? "offices" : `${type}s`;
      const endpoint = isAgencyOrOffice
        ? (editingId ? `/api/${pluralType}/${editingId}` : `/api/${pluralType}`)
        : `/api/settings/${type}`;

      const method = editingId ? "PUT" : "POST";
      const payload = isAgencyOrOffice
        ? { code: genericForm.code || genericForm.name.toLowerCase().replace(/ /g, "_"), name: genericForm.name }
        : { name: genericForm.name };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });

      if (res.ok) {
        toast.success("Saved successfully");
        setOpenModal(null);
        setEditingId(null);
        loadAllSettings();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Failed to save");
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Something went wrong");
    }
  };

  const handleSaveVendorService = async () => {
    if (!vendorSvcForm.vendor || !vendorSvcForm.service) {
      toast.error("Please select both vendor and service");
      return;
    }
    try {
      const res = await fetch("/api/settings/vendorService", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendorSvcForm),
      });
      if (res.ok) {
        toast.success("Vendor service configuration added");
        setOpenModal(null);
        loadAllSettings();
      } else {
        toast.error("Failed to add vendor service");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleDeleteItem = async (type: string, id: number | string) => {
    if (!window.confirm("Are you sure you want to delete this setting?")) return;
    try {
      const isAgencyOrOffice = type === "agency" || type === "office";
      const pluralType = type === "agency" ? "agencies" : type === "office" ? "offices" : `${type}s`;
      const endpoint = isAgencyOrOffice
        ? `/api/${pluralType}/${id}`
        : `/api/settings/${type}?id=${id}`;

      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted successfully");
        loadAllSettings();
      } else {
        toast.error("Failed to delete item");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  // Switch Toggles for Notifications
  const handleToggleNotification = async (index: number, channel: "email" | "whatsapp" | "webhook", val: boolean) => {
    const updated = [...notifications];
    updated[index][channel] = val;
    setNotifications(updated);

    try {
      await fetch("/api/settings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "settings_notifications", value: JSON.stringify(updated) }),
      });
      toast.success("Notification preferences updated");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  // Save Billing Changes
  const handleSaveBilling = async () => {
    try {
      const res = await fetch("/api/settings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "settings_billing", value: JSON.stringify(billing) }),
      });
      if (res.ok) {
        toast.success("Billing and currency configuration saved!");
      } else {
        toast.error("Failed to save billing settings");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const handleSaveBookingNumbering = async () => {
    try {
      const res = await fetch("/api/settings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "settings_booking_numbering", value: JSON.stringify(bookingNumbering) }),
      });
      if (res.ok) {
        toast.success("Booking numbering sequence updated successfully!");
      } else {
        toast.error("Failed to save booking numbering settings");
      }
    } catch {
      toast.error("Something went wrong");
    }
  };

  const getBookingNumberPreview = () => {
    const { prefix, suffix, padding, nextNumber } = bookingNumbering;
    const numStr = String(nextNumber || 1);
    const padded = numStr.padStart(Number(padding) || 0, "0");
    return `${prefix || ""}${padded}${suffix || ""}`;
  };

  // Helper status color mapping
  const getBadgeColor = (color: string) => {
    return {
      backgroundColor: `${color}15`,
      color: color,
      border: `1px solid ${color}30`
    };
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-gray-50 dark:bg-zinc-950 transition-all duration-300 ml-0 min-h-[calc(100vh-64px)] text-sm">
      
      {/* Header section */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Manage your organization preferences and system configuration.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Vertical Menu */}
        <div className="w-full lg:w-72 shrink-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-3 space-y-1 shadow-sm">
          {tabsList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-left transition-all duration-200 group ${
                  isActive
                    ? "bg-[#4F46E5]/10 text-[#4F46E5] font-semibold border border-[#4F46E5]/20"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60 border border-transparent"
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-[#4F46E5]" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-white"}`} />
                <div className="min-w-0">
                  <span className="block text-sm leading-tight">{tab.label}</span>
                  <span className="block text-xs text-gray-400 dark:text-zinc-500 mt-0.5 font-normal truncate">{tab.description}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Active Tab Content Card */}
        <div className="flex-1 w-full min-w-0">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              
              {/* Tab 1: Shipment Statuses */}
              {activeTab === "statuses" && (
                <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                  <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 dark:border-zinc-800/60 pb-5 gap-4">
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Shipment Statuses</CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Manage shipment statuses with custom icons and colors.
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={() => {
                        setEditingId(null);
                        setStatusForm({ name: "", code: "", color: "#4F46E5", order: statuses.length, status: "Active" });
                        setOpenModal("status");
                      }}
                      className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Add Status
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    
                    {/* Filters */}
                    <div className="flex justify-between items-center gap-4 mb-6">
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input 
                          placeholder="Search statuses..." 
                          value={statusSearch}
                          onChange={(e) => setStatusSearch(e.target.value)}
                          className="pl-9 text-sm rounded-lg border-gray-200 dark:border-zinc-800"
                        />
                      </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto border border-gray-100 dark:border-zinc-850 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                            <th className="px-5 py-3.5">Status Name</th>
                            <th className="px-5 py-3.5">Code</th>
                            <th className="px-5 py-3.5">Icon</th>
                            <th className="px-5 py-3.5">Color</th>
                            <th className="px-5 py-3.5">Order</th>
                            <th className="px-5 py-3.5">Status</th>
                            <th className="px-5 py-3.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                          {statuses
                            .filter(s => s.name.toLowerCase().includes(statusSearch.toLowerCase()) || (s.code || "").toLowerCase().includes(statusSearch.toLowerCase()))
                            .map((s) => (
                            <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                              <td className="px-5 py-4 font-medium">
                                <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={getBadgeColor(s.color || "#4F46E5")}>
                                  {s.name}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">{s.code || s.name.toLowerCase().replace(/ /g, "_")}</code>
                              </td>
                              <td className="px-5 py-4 text-gray-550 font-mono text-xs">
                                {s.icon || "Clock"}
                              </td>
                              <td className="px-5 py-4 flex items-center gap-2">
                                <div className="w-4 h-4 rounded-md border border-gray-200 dark:border-zinc-700" style={{ backgroundColor: s.color || "#4F46E5" }} />
                                <span className="text-xs text-gray-500 font-mono">{s.color || "#4F46E5"}</span>
                              </td>
                              <td className="px-5 py-4 font-mono">{s.order ?? 0}</td>
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'Active' || !s.status ? 'bg-green-50 text-green-700 border border-green-200/50' : 'bg-red-50 text-red-700 border border-red-200/50'}`}>
                                  {s.status || "Active"}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => {
                                      setEditingId(s.id);
                                      setStatusForm({ name: s.name, code: s.code || "", color: s.color || "#4F46E5", order: s.order || 0, status: s.status || "Active" });
                                      setOpenModal("status");
                                    }} className="flex items-center gap-2">
                                      <Edit3 className="w-3.5 h-3.5" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteItem("deliveryStatus", s.id)} className="flex items-center gap-2 text-red-600">
                                      <Trash2 className="w-3.5 h-3.5" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tab 2: Services & Sub-tabs */}
              {activeTab === "services" && (
                <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                  
                  {/* Service modes selection sub tabs */}
                  <div className="border-b border-gray-100 dark:border-zinc-800 px-5 pt-4">
                    <div className="flex flex-wrap gap-2 -mb-px">
                      {[
                        { id: "services", label: "Services (Standard)", icon: Truck },
                        { id: "shippingModes", label: "Shipping Modes", icon: Layers },
                        { id: "deliveryTimes", label: "Delivery Times", icon: Clock },
                        { id: "packagingTypes", label: "Packaging Types", icon: Package },
                        { id: "vendorServices", label: "Vendor Services", icon: Briefcase },
                        { id: "agencies", label: "Branches", icon: Building },
                        { id: "offices", label: "Offices", icon: Building }
                      ].map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setServiceSubTab(subTab.id as ServiceSubTab)}
                          className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-sm font-semibold transition-all ${
                            serviceSubTab === subTab.id
                              ? "border-[#4F46E5] text-[#4F46E5]"
                              : "border-transparent text-gray-550 hover:text-gray-800 dark:hover:text-white"
                          }`}
                        >
                          <subTab.icon className="w-4 h-4" />
                          {subTab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <CardContent className="pt-6">
                    
                    {/* View 2a: Services */}
                    {serviceSubTab === "services" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Services Configuration</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage shipping services by mode: air, sea, land.</p>
                          </div>
                          <Button 
                            onClick={() => {
                              setEditingId(null);
                              setServiceForm({ name: "", code: "", mode: "Air", currency: "USD", status: "Active" });
                              setOpenModal("service");
                            }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Service
                          </Button>
                        </div>

                        <div className="relative w-full max-w-sm mb-4">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                          <Input 
                            placeholder="Search services..." 
                            value={servicesSearch}
                            onChange={(e) => setServicesSearch(e.target.value)}
                            className="pl-9 text-sm rounded-lg border-gray-200 dark:border-zinc-800"
                          />
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-850 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Service Name</th>
                                <th className="px-5 py-3.5">Code</th>
                                <th className="px-5 py-3.5">Mode</th>
                                <th className="px-5 py-3.5">Currency</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {services
                                .filter(s => s.name.toLowerCase().includes(servicesSearch.toLowerCase()))
                                .map((s) => (
                                <tr key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-blue-600 dark:text-blue-400">{s.name}</td>
                                  <td className="px-5 py-4 font-mono text-xs text-gray-550">{s.code || s.name.toLowerCase().replace(/ /g, "_")}</td>
                                  <td className="px-5 py-4 font-medium">{s.mode || "Air"}</td>
                                  <td className="px-5 py-4 font-mono font-bold text-gray-555">{s.currency || "USD"}</td>
                                  <td className="px-5 py-4">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.status === 'Active' || !s.status ? 'bg-green-50 text-green-700 border border-green-200/50' : 'bg-red-50 text-red-700 border border-red-200/50'}`}>
                                      {s.status || "Active"}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => {
                                          setEditingId(s.id);
                                          setServiceForm({ name: s.name, code: s.code || "", mode: s.mode || "Air", currency: s.currency || "USD", status: s.status || "Active" });
                                          setOpenModal("service");
                                        }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("serviceMode", s.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2b: Shipping Modes */}
                    {serviceSubTab === "shippingModes" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Shipping Modes</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage shipping modes for your shipments.</p>
                          </div>
                          <Button 
                            onClick={() => { setEditingId(null); setGenericForm({ name: "", code: "" }); setOpenModal("shippingMode"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Shipping Mode
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Mode Name</th>
                                <th className="px-5 py-3.5">Code</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {shippingModes.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                  <td className="px-5 py-4">
                                    <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">
                                      {item.name.toLowerCase().replace(/ /g, "_")}
                                    </code>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setGenericForm({ name: item.name, code: "" }); setOpenModal("shippingMode"); }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("shippingMode", item.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2c: Delivery Times */}
                    {serviceSubTab === "deliveryTimes" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Delivery Times</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage delivery transit time frames.</p>
                          </div>
                          <Button 
                            onClick={() => { setEditingId(null); setGenericForm({ name: "", code: "" }); setOpenModal("deliveryTime"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Delivery Time
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Time Frame</th>
                                <th className="px-5 py-3.5">Code</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {deliveryTimes.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                  <td className="px-5 py-4">
                                    <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">
                                      {item.name.toLowerCase().replace(/ /g, "_")}
                                    </code>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setGenericForm({ name: item.name, code: "" }); setOpenModal("deliveryTime"); }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("deliveryTime", item.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2d: Packaging Types */}
                    {serviceSubTab === "packagingTypes" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Packaging Types</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage packaging options (e.g., box, envelope).</p>
                          </div>
                          <Button 
                            onClick={() => { setEditingId(null); setGenericForm({ name: "", code: "" }); setOpenModal("packagingType"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Packaging Type
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Packaging Name</th>
                                <th className="px-5 py-3.5">Code</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {packagingTypes.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                  <td className="px-5 py-4">
                                    <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">
                                      {item.name.toLowerCase().replace(/ /g, "_")}
                                    </code>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setGenericForm({ name: item.name, code: "" }); setOpenModal("packagingType"); }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("packagingType", item.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2e: Vendor Services */}
                    {serviceSubTab === "vendorServices" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Vendor Services</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Map services to specific vendors.</p>
                          </div>
                          <Button 
                            onClick={() => { setVendorSvcForm({ vendor: "", service: "" }); setOpenModal("vendorService"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Vendor Service
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Vendor Name</th>
                                <th className="px-5 py-3.5">Mapped Services</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {(() => {
                                const grouped: Record<string, any[]> = {};
                                vendorServices.forEach((item: any) => {
                                  if (!grouped[item.vendor]) grouped[item.vendor] = [];
                                  grouped[item.vendor].push(item);
                                });

                                return Object.entries(grouped).map(([vendorName, svcList]) => (
                                  <tr key={vendorName} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                    <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">{vendorName}</td>
                                    <td className="px-5 py-4">
                                      <div className="flex flex-wrap gap-2">
                                        {svcList.map((svc) => (
                                          <span key={svc.id} className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200/40 animate-fade-in">
                                            {svc.service}
                                            <button onClick={() => handleDeleteItem("vendorService", svc.id)} className="text-red-500 hover:text-red-700 ml-2 font-bold text-sm">
                                              ×
                                            </button>
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2f: Agencies */}
                    {serviceSubTab === "agencies" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Branches</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage regional offices or agent branches.</p>
                          </div>
                          <Button 
                            onClick={() => { setEditingId(null); setGenericForm({ name: "", code: "" }); setOpenModal("agency"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Branch
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Branch Name</th>
                                <th className="px-5 py-3.5">Short Code</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {agencies.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                  <td className="px-5 py-4">
                                    <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">
                                      {item.code}
                                    </code>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setGenericForm({ name: item.name, code: item.code }); setOpenModal("agency"); }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("agency", item.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* View 2g: Offices */}
                    {serviceSubTab === "offices" && (
                      <div>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-bold text-gray-905 dark:text-white">Offices</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage localized drop-off and pickup centers.</p>
                          </div>
                          <Button 
                            onClick={() => { setEditingId(null); setGenericForm({ name: "", code: "" }); setOpenModal("office"); }}
                            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-lg"
                          >
                            <Plus className="w-4 h-4" />
                            Add Office
                          </Button>
                        </div>

                        <div className="overflow-x-auto border border-gray-100 dark:border-zinc-855 rounded-xl">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                                <th className="px-5 py-3.5">Office Name</th>
                                <th className="px-5 py-3.5">Short Code</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                              {offices.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                                  <td className="px-5 py-4 font-semibold text-gray-900 dark:text-white">{item.name}</td>
                                  <td className="px-5 py-4">
                                    <code className="bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-gray-650 dark:text-zinc-400 font-mono">
                                      {item.code}
                                    </code>
                                  </td>
                                  <td className="px-5 py-4 text-right">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => { setEditingId(item.id); setGenericForm({ name: item.name, code: item.code }); setOpenModal("office"); }} className="flex items-center gap-2">
                                          <Edit3 className="w-3.5 h-3.5" />
                                          Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteItem("office", item.id)} className="flex items-center gap-2 text-red-600">
                                          <Trash2 className="w-3.5 h-3.5" />
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
              )}

              {/* Tab 3: Notifications */}
              {activeTab === "notifications" && (
                <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                  <CardHeader className="border-b border-gray-100 dark:border-zinc-800 pb-5">
                    <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Notification Rules</CardTitle>
                    <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Manage how and when notifications are sent.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    
                    {/* Inner tab list */}
                    <div className="flex border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 rounded-lg p-1 max-w-sm mb-6">
                      <button className="flex-1 py-2 text-sm font-semibold bg-white dark:bg-zinc-700 shadow-sm border border-gray-100 dark:border-zinc-600 rounded text-[#4F46E5] text-center">
                        Rules
                      </button>
                      <button className="flex-1 py-2 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white text-center">
                        Templates
                      </button>
                      <button className="flex-1 py-2 text-sm font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white text-center">
                        Channels
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-gray-100 dark:border-zinc-850 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-zinc-800/40 text-xs font-bold text-gray-500 dark:text-zinc-400 border-b border-gray-100 dark:border-zinc-800">
                            <th className="px-5 py-4 w-1/3">Event</th>
                            <th className="px-5 py-4">Email</th>
                            <th className="px-5 py-4">WhatsApp</th>
                            <th className="px-5 py-4">Webhook</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 text-sm text-gray-700 dark:text-zinc-300">
                          {notifications.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                              <td className="px-5 py-5 font-semibold text-gray-900 dark:text-white">{row.event}</td>
                              <td className="px-5 py-5">
                                <Switch 
                                  checked={row.email} 
                                  onCheckedChange={(val) => handleToggleNotification(index, "email", val)}
                                  className="data-[state=checked]:bg-[#4F46E5]"
                                />
                              </td>
                              <td className="px-5 py-5">
                                <Switch 
                                  checked={row.whatsapp} 
                                  onCheckedChange={(val) => handleToggleNotification(index, "whatsapp", val)}
                                  className="data-[state=checked]:bg-[#4F46E5]"
                                />
                              </td>
                              <td className="px-5 py-5">
                                <Switch 
                                  checked={row.webhook} 
                                  onCheckedChange={(val) => handleToggleNotification(index, "webhook", val)}
                                  className="data-[state=checked]:bg-[#4F46E5]"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tab 4: Billing */}
              {activeTab === "billing" && (
                <div className="space-y-6">
                  
                  {/* Currency & Invoicing Card */}
                  <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800 pb-5">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Currency & Invoicing</CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Default currency, payment terms, and invoice footer text.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">DEFAULT CURRENCY *</Label>
                          <Select 
                            value={billing.currency} 
                            onValueChange={(val) => setBilling((prev: any) => ({ ...prev, currency: val }))}
                          >
                            <SelectTrigger className="w-full text-sm">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD - United States Dollar ($)">USD - United States Dollar ($)</SelectItem>
                              <SelectItem value="PKR - Pakistani Rupee (Rs)">PKR - Pakistani Rupee (Rs)</SelectItem>
                              <SelectItem value="EUR - Euro (€)">EUR - Euro (€)</SelectItem>
                              <SelectItem value="GBP - British Pound (£)">GBP - British Pound (£)</SelectItem>
                              <SelectItem value="AED - UAE Dirham (AED)">AED - UAE Dirham (AED)</SelectItem>
                              <SelectItem value="INR - Indian Rupee (₹)">INR - Indian Rupee (₹)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-400 mt-1">Used as default for new shipments and invoices.</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">TAX (MANAGED IN SHIPPING CONFIG)</Label>
                          <div className="flex items-center gap-3 border border-gray-200 dark:border-zinc-850 rounded-lg px-3.5 py-2.5 bg-gray-50/50 dark:bg-zinc-850">
                            <span className="text-sm font-mono text-gray-700 dark:text-gray-300">Tax</span>
                            <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded text-xs border border-blue-200/50">{billing.tax || "0%"}</span>
                            <button onClick={() => {
                              const newTax = prompt("Enter Tax Percentage (e.g. 5%):", billing.tax);
                              if (newTax !== null) setBilling((p: any) => ({ ...p, tax: newTax }));
                            }} className="text-sm text-indigo-600 hover:text-indigo-800 font-bold ml-auto">
                              Edit →
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Tax name and rate are configured in Shipping Configuration and applied to all invoices.</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">PAYMENT TERMS</Label>
                        <Textarea 
                          value={billing.paymentTerms} 
                          onChange={(e) => setBilling((p: any) => ({ ...p, paymentTerms: e.target.value }))}
                          placeholder="e.g. Payment is due upon receipt."
                          className="text-sm rounded-lg"
                        />
                        <p className="text-xs text-gray-400 mt-1">Printed in the "Terms" section of every invoice.</p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">INVOICE FOOTER</Label>
                        <Textarea 
                          value={billing.invoiceFooter} 
                          onChange={(e) => setBilling((p: any) => ({ ...p, invoiceFooter: e.target.value }))}
                          placeholder="e.g. Thank you for your business."
                          className="text-sm rounded-lg"
                        />
                        <p className="text-xs text-gray-400 mt-1">Appears at the bottom of every invoice.</p>
                      </div>

                    </CardContent>
                  </Card>

                  {/* Invoice Design Card */}
                  <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800 pb-5">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Invoice Design</CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose the visual style for your documents.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        
                        {/* Option 1 */}
                        <div 
                          onClick={() => setBilling((p: any) => ({ ...p, invoiceDesign: "MODERN PURPLE" }))}
                          className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                            billing.invoiceDesign === "MODERN PURPLE"
                              ? "border-[#4F46E5] bg-[#4F46E5]/5"
                              : "border-gray-200 dark:border-zinc-800 hover:border-gray-400"
                          }`}
                        >
                          <div className="bg-[#4F46E5] text-white px-3 py-1 text-xs font-bold rounded-md inline-block uppercase tracking-wider">
                            Modern Purple
                          </div>
                          <div className="mt-4 border border-gray-200 dark:border-zinc-800 rounded-lg p-3 aspect-[4/3] bg-indigo-950/90 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-white">PSS INVOICE</span>
                              <span className="text-[10px] text-gray-300">#INV-00123</span>
                            </div>
                            <div className="space-y-1">
                              <div className="w-1/2 h-1.5 bg-gray-400/50 rounded" />
                              <div className="w-1/3 h-1 bg-gray-400/50 rounded" />
                            </div>
                            <div className="flex justify-between items-end border-t border-gray-700/50 pt-2">
                              <span className="text-[10px] text-gray-300">Total</span>
                              <span className="text-sm font-bold text-[#A5B4FC]">$2,500.00</span>
                            </div>
                          </div>
                          {billing.invoiceDesign === "MODERN PURPLE" && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-[#4F46E5] text-white rounded-full flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Option 2 */}
                        <div 
                          onClick={() => setBilling((p: any) => ({ ...p, invoiceDesign: "EXPRESS RED" }))}
                          className={`relative border-2 rounded-xl p-4 cursor-pointer transition-all ${
                            billing.invoiceDesign === "EXPRESS RED"
                              ? "border-red-500 bg-red-500/5"
                              : "border-gray-200 dark:border-zinc-800 hover:border-gray-400"
                          }`}
                        >
                          <div className="bg-red-500 text-white px-3 py-1 text-xs font-bold rounded-md inline-block uppercase tracking-wider">
                            Express Red
                          </div>
                          <div className="mt-4 border border-gray-200 dark:border-zinc-800 rounded-lg p-3 aspect-[4/3] bg-red-950/90 flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold text-white">PSS EXPRESS</span>
                              <span className="text-[10px] text-gray-300">#INV-00123</span>
                            </div>
                            <div className="space-y-1">
                              <div className="w-1/2 h-1.5 bg-gray-400/50 rounded" />
                              <div className="w-1/3 h-1 bg-gray-400/50 rounded" />
                            </div>
                            <div className="flex justify-between items-end border-t border-red-900/50 pt-2">
                              <span className="text-[10px] text-gray-300">Total</span>
                              <span className="text-sm font-bold text-[#FCA5A5]">$2,500.00</span>
                            </div>
                          </div>
                          {billing.invoiceDesign === "EXPRESS RED" && (
                            <div className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>

                      </div>

                      {/* Submit */}
                      <div className="mt-8 flex justify-end">
                        <Button 
                          onClick={handleSaveBilling}
                          className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-2.5 font-semibold rounded-lg text-sm"
                        >
                          Save Changes
                        </Button>
                      </div>

                    </CardContent>
                  </Card>

                </div>
              )}

              {/* Tab 5: Booking Numbers */}
              {activeTab === "bookingNumbering" && (
                <div className="space-y-6 animate-fadeIn">
                  
                  <Card className="shadow-sm border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl">
                    <CardHeader className="border-b border-gray-100 dark:border-zinc-800 pb-5">
                      <CardTitle className="text-xl font-bold text-gray-900 dark:text-white">Booking numbering</CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Prefix, padding and next number for booking numbers.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">PREFIX</Label>
                          <Input 
                            value={bookingNumbering.prefix}
                            onChange={(e) => setBookingNumbering((prev: any) => ({ ...prev, prefix: e.target.value }))}
                            placeholder="e.g. TRK, BK"
                            className="text-sm rounded-lg"
                          />
                          <p className="text-xs text-gray-400 mt-1">Letters shown before the number (e.g. TRK, DEP).</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">SUFFIX</Label>
                          <Input 
                            value={bookingNumbering.suffix}
                            onChange={(e) => setBookingNumbering((prev: any) => ({ ...prev, suffix: e.target.value }))}
                            placeholder="e.g. suffix"
                            className="text-sm rounded-lg"
                          />
                          <p className="text-xs text-gray-400 mt-1">Letters shown after the number (optional).</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">PADDING</Label>
                          <Input 
                            type="number"
                            value={bookingNumbering.padding}
                            onChange={(e) => setBookingNumbering((prev: any) => ({ ...prev, padding: parseInt(e.target.value) || 0 }))}
                            placeholder="e.g. 8"
                            className="text-sm rounded-lg"
                          />
                          <p className="text-xs text-gray-400 mt-1">Minimum digits; shorter numbers are zero-padded.</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">NEXT #</Label>
                          <Input 
                            type="number"
                            value={bookingNumbering.nextNumber}
                            onChange={(e) => setBookingNumbering((prev: any) => ({ ...prev, nextNumber: parseInt(e.target.value) || 1 }))}
                            placeholder="e.g. 45"
                            className="text-sm rounded-lg"
                          />
                          <p className="text-xs text-gray-400 mt-1">The number that will be used on the next booking number generated.</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-700 dark:text-zinc-300">RESET</Label>
                        <Select 
                          value={bookingNumbering.reset} 
                          onValueChange={(val) => setBookingNumbering((prev: any) => ({ ...prev, reset: val }))}
                        >
                          <SelectTrigger className="w-full text-sm">
                            <SelectValue placeholder="Select reset interval" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Never">Never</SelectItem>
                            <SelectItem value="Daily">Daily</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-400 mt-1">Automatically resets the counter to 1 on the chosen interval.</p>
                      </div>

                      {/* Preview Card */}
                      <Card className="shadow-none border border-gray-150 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-850/30 rounded-lg p-4">
                        <div className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Next Number Preview</div>
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1.5 font-mono">
                          {getBookingNumberPreview()}
                        </div>
                      </Card>

                      {/* Submit */}
                      <div className="mt-8 flex justify-end">
                        <Button 
                          onClick={handleSaveBookingNumbering}
                          className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 py-2.5 font-semibold rounded-lg text-sm"
                        >
                          Update booking sequence
                        </Button>
                      </div>

                    </CardContent>
                  </Card>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* ======================================================== */}
      {/* DIALOGS / POPUPS FOR CRUD                                */}
      {/* ======================================================== */}

      {/* Modal 1: Status Add/Edit */}
      <Dialog open={openModal === "status"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Status" : "Add Status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs">Status Name</Label>
              <Input 
                value={statusForm.name} 
                onChange={(e) => setStatusForm(prev => ({ ...prev, name: e.target.value, code: e.target.value.toLowerCase().replace(/ /g, "_") }))}
                placeholder="e.g. Pending"
                className="text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Code</Label>
              <Input 
                value={statusForm.code} 
                onChange={(e) => setStatusForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. pending"
                className="text-sm font-mono rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Color Hex</Label>
              <div className="flex gap-3">
                <input 
                  type="color" 
                  value={statusForm.color} 
                  onChange={(e) => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 border rounded-lg cursor-pointer shrink-0" 
                />
                <Input 
                  value={statusForm.color} 
                  onChange={(e) => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="#4F46E5"
                  className="text-sm font-mono rounded-lg"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Sort Order</Label>
              <Input 
                type="number"
                value={statusForm.order} 
                onChange={(e) => setStatusForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                className="text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select 
                value={statusForm.status} 
                onValueChange={(val) => setStatusForm(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={handleSaveStatus} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Service Add/Edit */}
      <Dialog open={openModal === "service"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs">Service Name</Label>
              <Input 
                value={serviceForm.name} 
                onChange={(e) => setServiceForm(prev => ({ ...prev, name: e.target.value, code: e.target.value.toLowerCase().replace(/ /g, "_") }))}
                placeholder="e.g. Express Air"
                className="text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Code</Label>
              <Input 
                value={serviceForm.code} 
                onChange={(e) => setServiceForm(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. express_air"
                className="text-sm font-mono rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Mode</Label>
              <Select 
                value={serviceForm.mode} 
                onValueChange={(val) => setServiceForm(prev => ({ ...prev, mode: val }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Air">Air</SelectItem>
                  <SelectItem value="Land">Land</SelectItem>
                  <SelectItem value="Sea">Sea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Currency</Label>
              <Input 
                value={serviceForm.currency} 
                onChange={(e) => setServiceForm(prev => ({ ...prev, currency: e.target.value }))}
                placeholder="USD"
                className="text-sm rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select 
                value={serviceForm.status} 
                onValueChange={(val) => setServiceForm(prev => ({ ...prev, status: val }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={handleSaveService} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Generic setting models (shippingMode, deliveryTime, packagingType, agency, office) */}
      <Dialog open={
        openModal === "shippingMode" || 
        openModal === "deliveryTime" || 
        openModal === "packagingType" || 
        openModal === "agency" || 
        openModal === "office"
      } onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit" : "Add"} {
                openModal === "shippingMode" ? "Shipping Mode" :
                openModal === "deliveryTime" ? "Delivery Time" :
                openModal === "packagingType" ? "Packaging Type" :
                openModal === "agency" ? "Branch" : "Office"
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            {(openModal === "agency" || openModal === "office") && (
              <div className="space-y-2">
                <Label className="text-xs">Code / Short Code</Label>
                <Input 
                  value={genericForm.code} 
                  onChange={(e) => setGenericForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. KHI"
                  className="text-sm rounded-lg font-mono"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Name</Label>
              <Input 
                value={genericForm.name} 
                onChange={(e) => setGenericForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Standard"
                className="text-sm rounded-lg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={() => handleSaveGeneric(openModal!)} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 5: Vendor Services Add */}
      <Dialog open={openModal === "vendorService"} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className="max-w-md w-full">
          <DialogHeader>
            <DialogTitle>Add Vendor Service Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs">Vendor</Label>
              <Select 
                value={vendorSvcForm.vendor} 
                onValueChange={(val) => setVendorSvcForm(prev => ({ ...prev, vendor: val }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select Vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.CompanyName}>{v.CompanyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Service</Label>
              <Select 
                value={vendorSvcForm.service} 
                onValueChange={(val) => setVendorSvcForm(prev => ({ ...prev, service: val }))}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select Service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenModal(null)}>Cancel</Button>
            <Button onClick={handleSaveVendorService} className="bg-[#4F46E5] text-white">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
