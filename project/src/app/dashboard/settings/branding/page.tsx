"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { 
  Building2, Save, Palette, Upload, Sun, Moon, 
  Monitor, FileText, Check, AlertCircle, Info, RefreshCw
} from "lucide-react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrgData = {
  id: number;
  name: string;
  slug: string;
  status: string;
  currency: string;
  logoUrl: string | null;
  createdAt: string;
};

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "INR", "SAR"];
const MANAGE_ROLES = ["OWNER", "ADMIN"];

const ACCENT_COLORS = [
  { name: "Indigo", value: "indigo", class: "bg-indigo-600" },
  { name: "Blue", value: "blue", class: "bg-blue-600" },
  { name: "Emerald", value: "emerald", class: "bg-emerald-600" },
  { name: "Rose", value: "rose", class: "bg-rose-600" },
  { name: "Amber", value: "amber", class: "bg-amber-500" },
  { name: "Zinc", value: "zinc", class: "bg-zinc-700" },
];

export default function BrandingSettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [org, setOrg] = useState<OrgData | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [logoUrl, setLogoUrl] = useState("");

  // Recommended Settings (Stored in LocalStorage / Mocked for Brand customization)
  const [accentColor, setAccentColor] = useState("blue");
  const [invoiceDisclaimer, setInvoiceDisclaimer] = useState("");
  const [invoiceSupportEmail, setInvoiceSupportEmail] = useState("");
  const [invoiceSupportPhone, setInvoiceSupportPhone] = useState("");
  const [invoiceSupportAddress, setInvoiceSupportAddress] = useState("");

  // Saved / DB states for robust dirty checking
  const [savedName, setSavedName] = useState("");
  const [savedCurrency, setSavedCurrency] = useState("PKR");
  const [savedLogoUrl, setSavedLogoUrl] = useState("");
  const [savedAccentColor, setSavedAccentColor] = useState("blue");
  const [savedDisclaimer, setSavedDisclaimer] = useState("");
  const [savedSupportEmail, setSavedSupportEmail] = useState("");
  const [savedSupportPhone, setSavedSupportPhone] = useState("");
  const [savedSupportAddress, setSavedSupportAddress] = useState("");

  // Fix hydration mismatch for next-themes
  useEffect(() => {
    setMounted(true);
    // Load local storage values if present
    const color = localStorage.getItem("brand_accent_color") || "blue";
    const disclaimer = localStorage.getItem("brand_invoice_disclaimer") || 
      "Any discrepancy in invoice must be notified within 03 days of receipt of this invoice. You are requested to pay the invoice amount through cash payment or cross cheque with immediate effect.";
    const email = localStorage.getItem("brand_support_email") || "info@psswwe.com";
    const phone = localStorage.getItem("brand_support_phone") || "+92 (21) 111-222-333";
    const address = localStorage.getItem("brand_support_address") || "LG-44, Land Mark Plaza, 5-6 Jail Road, Lahore";

    setAccentColor(color);
    setInvoiceDisclaimer(disclaimer);
    setInvoiceSupportEmail(email);
    setInvoiceSupportPhone(phone);
    setInvoiceSupportAddress(address);

    setSavedAccentColor(color);
    setSavedDisclaimer(disclaimer);
    setSavedSupportEmail(email);
    setSavedSupportPhone(phone);
    setSavedSupportAddress(address);
  }, []);

  const canManage = MANAGE_ROLES.includes(role);

  const loadOrg = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/org/current");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load organization");
      const o: OrgData = data.organization;
      setOrg(o);
      setRole(data.role || "");
      setName(o.name);
      setCurrency(o.currency || "PKR");
      setLogoUrl(o.logoUrl || "");

      setSavedName(o.name);
      setSavedCurrency(o.currency || "PKR");
      setSavedLogoUrl(o.logoUrl || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrg();
  }, [loadOrg]);

  // File Upload handler for Logo
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG, or SVG)");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Upload new logo to Supabase storage
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const newLogoUrl = uploadData.url;

      // 2. Immediately save to database to prevent disappearing on refresh
      const patchRes = await fetch("/api/org/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: newLogoUrl }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error || "Failed to save logo to database");

      // 3. Delete the old logo from Supabase storage if it exists (so they don't accumulate)
      if (logoUrl) {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: logoUrl }),
        }).catch((err) => console.error("Error deleting old logo file from storage:", err));
      }

      setLogoUrl(newLogoUrl);
      setSavedLogoUrl(newLogoUrl);
      setOrg((prev) => (prev ? { ...prev, logoUrl: newLogoUrl } : prev));
      window.dispatchEvent(new Event("orgBrandingUpdated"));
      toast.success("Logo uploaded and saved successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Remove Logo from database and Supabase storage
  const handleRemoveLogo = async () => {
    if (!logoUrl) return;
    setUploading(true);
    try {
      // 1. Delete from Supabase Storage
      const delRes = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: logoUrl }),
      });
      const delData = await delRes.json();
      if (!delRes.ok) console.warn("Failed to delete file from storage bucket:", delData.error);

      // 2. PATCH database to set logoUrl to null
      const patchRes = await fetch("/api/org/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: null }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error || "Failed to remove logo from database");

      setLogoUrl("");
      setSavedLogoUrl("");
      setOrg((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      window.dispatchEvent(new Event("orgBrandingUpdated"));
      toast.success("Logo removed from database and storage successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setUploading(false);
    }
  };

  const saveBranding = async () => {
    setSaving(true);
    try {
      // 1. Save org fields on the database
      const res = await fetch("/api/org/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, logoUrl: logoUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // 2. Save custom branding in local storage
      localStorage.setItem("brand_accent_color", accentColor);
      localStorage.setItem("brand_invoice_disclaimer", invoiceDisclaimer);
      localStorage.setItem("brand_support_email", invoiceSupportEmail);
      localStorage.setItem("brand_support_phone", invoiceSupportPhone);
      localStorage.setItem("brand_support_address", invoiceSupportAddress);

      // 3. Update saved states for dirty calculation
      setSavedName(name);
      setSavedCurrency(currency);
      setSavedLogoUrl(logoUrl);
      setSavedAccentColor(accentColor);
      setSavedDisclaimer(invoiceDisclaimer);
      setSavedSupportEmail(invoiceSupportEmail);
      setSavedSupportPhone(invoiceSupportPhone);
      setSavedSupportAddress(invoiceSupportAddress);

      // Trigger a custom event to tell the navbar/sidebar to reload the logo
      window.dispatchEvent(new Event("orgBrandingUpdated"));

      toast.success("Branding and interface settings updated successfully!");
      setOrg((prev) => (prev ? { ...prev, ...data.organization } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-muted-foreground flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Loading branding settings…
      </div>
    );
  }

  if (!org) {
    return <div className="p-6 text-muted-foreground">Organization not found.</div>;
  }

  const isDirty =
    name !== savedName ||
    currency !== savedCurrency ||
    logoUrl !== savedLogoUrl ||
    accentColor !== savedAccentColor ||
    invoiceDisclaimer !== savedDisclaimer ||
    invoiceSupportEmail !== savedSupportEmail ||
    invoiceSupportPhone !== savedSupportPhone ||
    invoiceSupportAddress !== savedSupportAddress;

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Palette className="h-8 w-8 text-indigo-500" />
            Branding & Interface
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize organization logo, invoice styles, and interface themes.
          </p>
        </div>
        {canManage && (
          <Button 
            disabled={!isDirty || saving} 
            onClick={saveBranding}
            className="self-end sm:self-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        )}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Logo & Details Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Logo & Core Branding */}
          <Card className="bg-white dark:bg-slate-950/40 border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Brand Logo & Identity</CardTitle>
              <CardDescription className="text-xs">
                Upload your company logo. This will be used in waybills, invoices, and shipment receipts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Logo Preview and Upload */}
              <div className="flex flex-col md:flex-row items-center gap-6 p-4 border rounded-xl bg-slate-50/50 dark:bg-zinc-900/10">
                <div className="w-48 h-20 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center p-2 overflow-hidden shrink-0 relative group">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="Org Logo" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground flex flex-col items-center">
                      <Building2 className="w-6 h-6 mb-1 text-slate-350" />
                      <span>No custom logo</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center md:text-left">
                  <h4 className="text-sm font-semibold">Upload Logo Image</h4>
                  <p className="text-xs text-muted-foreground">
                    Recommended dimensions: 240x80px. Supported formats: PNG, JPG, JPEG, SVG. Max file size: 2MB.
                  </p>
                  
                  {canManage && (
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                      <Label htmlFor="logo-file" className="cursor-pointer">
                        <div className="inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2">
                          <Upload className="w-4 h-4 mr-2" />
                          Choose File
                        </div>
                      </Label>
                      <input
                        id="logo-file"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        disabled={uploading}
                      />
                      {logoUrl && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleRemoveLogo}
                          disabled={uploading}
                          className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        >
                          Remove Logo
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Core Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canManage}
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgCurrency">Default Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={setCurrency}
                    disabled={!canManage}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-950">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((cur) => (
                        <SelectItem key={cur} value={cur}>
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Disclaimer Customization */}
          <Card className="bg-white dark:bg-slate-950/40 border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Invoice & Receipt Customization</CardTitle>
              <CardDescription className="text-xs">
                Configure default content and contact details generated on customer invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    value={invoiceSupportEmail}
                    onChange={(e) => setInvoiceSupportEmail(e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. support@company.com"
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportPhone">Support Hotline</Label>
                  <Input
                    id="supportPhone"
                    value={invoiceSupportPhone}
                    onChange={(e) => setInvoiceSupportPhone(e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. +92 21 111-222"
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportAddress">Support Address</Label>
                  <Input
                    id="supportAddress"
                    value={invoiceSupportAddress}
                    onChange={(e) => setInvoiceSupportAddress(e.target.value)}
                    disabled={!canManage}
                    placeholder="e.g. LG-44, Land Mark Plaza, Lahore"
                    className="bg-white dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disclaimerText">Invoice Terms & Disclaimer</Label>
                <Textarea
                  id="disclaimerText"
                  value={invoiceDisclaimer}
                  onChange={(e) => setInvoiceDisclaimer(e.target.value)}
                  disabled={!canManage}
                  rows={4}
                  className="bg-white dark:bg-slate-950 text-xs"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Theme Selector & Appearance */}
        <div className="space-y-6">
          
          {/* Theme & Mode Select */}
          <Card className="bg-white dark:bg-slate-950/40 border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Theme & Mode</CardTitle>
              <CardDescription className="text-xs">
                Choose how you want the platform to look.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mounted && (
                <div className="grid grid-cols-3 gap-2">
                  
                  {/* Light Mode */}
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-xl text-center transition-all ${
                      theme === "light"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-900/20 text-muted-foreground"
                    }`}
                  >
                    <Sun className="h-6 w-6" />
                    <span className="text-xs font-semibold">Light</span>
                  </button>

                  {/* Dark Mode */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-xl text-center transition-all ${
                      theme === "dark"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-900/20 text-muted-foreground"
                    }`}
                  >
                    <Moon className="h-6 w-6" />
                    <span className="text-xs font-semibold">Dark</span>
                  </button>

                  {/* System Mode */}
                  <button
                    onClick={() => setTheme("system")}
                    className={`flex flex-col items-center gap-2 p-3 border rounded-xl text-center transition-all ${
                      theme === "system"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-900/20 text-muted-foreground"
                    }`}
                  >
                    <Monitor className="h-6 w-6" />
                    <span className="text-xs font-semibold">System</span>
                  </button>

                </div>
              )}
            </CardContent>
          </Card>

          {/* Accent Customization Swatches (Recommended Feature) */}
          <Card className="bg-white dark:bg-slate-950/40 border shadow-xs">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Accent Color Swatches</CardTitle>
              <CardDescription className="text-xs">
                Select your brand primary accent color for UI highlights.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-2">
                {ACCENT_COLORS.map((col) => (
                  <button
                    key={col.value}
                    onClick={() => setAccentColor(col.value)}
                    className={`w-9 h-9 rounded-full ${col.class} flex items-center justify-center text-white shadow-xs transition-transform hover:scale-110 relative`}
                    title={col.name}
                  >
                    {accentColor === col.value && (
                      <Check className="h-4 w-4 stroke-[3px]" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Preview Card */}
          <Card className="bg-white dark:bg-slate-950/40 border shadow-xs overflow-hidden">
            <CardHeader className="bg-slate-50/80 dark:bg-zinc-900/30 border-b pb-3.5">
              <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Live Invoice Header Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 bg-white dark:bg-zinc-950">
              <div className="border rounded-lg p-3 bg-slate-50/30 dark:bg-zinc-900/10 text-slate-800 dark:text-slate-300">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-8 rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold">PSS</span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white leading-none">{name || "Company"}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Prompt Survey & Services</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold">Invoice: INV-4859</span>
                    <p className="text-[8px] text-muted-foreground">Currency: {currency}</p>
                  </div>
                </div>
                <div className="border-t border-dashed my-2"></div>
                <div className="text-[10px] text-muted-foreground text-center mt-3">
                  {invoiceSupportAddress} | {invoiceSupportPhone} | {invoiceSupportEmail}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

    </div>
  );
}
