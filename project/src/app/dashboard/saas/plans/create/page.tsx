"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, FileText, Settings, DollarSign, Tag, Sliders, 
  Plus, Trash2, Check, ShieldAlert, Sparkles, SwitchCamera
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  platformRole?: string | null;
}

export default function CreatePlanPage() {
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  // General States
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("Manage subscription plans available to organizations.");
  const [currency, setCurrency] = useState("USD");
  const [sortOrder, setSortOrder] = useState("0");
  const [activeGeneral, setActiveGeneral] = useState(true);

  // Settings States
  const [trialDays, setTrialDays] = useState("14");
  const [gracePeriodDays, setGracePeriodDays] = useState("7");
  const [activeSettings, setActiveSettings] = useState(true);

  // Pricing States
  const [monthlyPrice, setMonthlyPrice] = useState("0.00");
  const [quarterlyPrice, setQuarterlyPrice] = useState("");
  const [semiannualPrice, setSemiannualPrice] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");

  // Features States
  const [featureInput, setFeatureInput] = useState("");
  const [featuresList, setFeaturesList] = useState<string[]>([
    "Multi-tenant isolation",
    "Real-time shipment tracking",
    "Basic accounting ledger",
  ]);

  // Limits States
  const [limits, setLimits] = useState<{ key: string; value: string }[]>([
    { key: "max_users", value: "10" },
    { key: "max_shipments", value: "1000" },
  ]);
  const [newLimitKey, setNewLimitKey] = useState("");
  const [newLimitValue, setNewLimitValue] = useState("");

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<DecodedToken>(token);
        setIsSuperAdmin(decoded.platformRole === "SUPER_ADMIN");
      } catch (err) {
        console.error("Token decoding failed:", err);
      }
    }
  }, []);

  // Sync Slug with Name
  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
  };

  const handleAddFeature = () => {
    if (featureInput.trim()) {
      if (featuresList.includes(featureInput.trim())) {
        toast.error("Feature already exists");
        return;
      }
      setFeaturesList([...featuresList, featureInput.trim()]);
      setFeatureInput("");
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFeaturesList(featuresList.filter((_, i) => i !== index));
  };

  const handleAddLimit = () => {
    if (newLimitKey.trim() && newLimitValue.trim()) {
      if (limits.some(l => l.key === newLimitKey.trim())) {
        toast.error("Limit key already exists");
        return;
      }
      setLimits([...limits, { key: newLimitKey.trim(), value: newLimitValue.trim() }]);
      setNewLimitKey("");
      setNewLimitValue("");
    }
  };

  const handleRemoveLimit = (key: string) => {
    setLimits(limits.filter(l => l.key !== key));
  };

  const handleCreatePlan = async () => {
    if (!name.trim()) {
      toast.error("Plan Name is required");
      return;
    }
    if (!slug.trim()) {
      toast.error("Slug is required");
      return;
    }
    if (!monthlyPrice.trim() || isNaN(Number(monthlyPrice))) {
      toast.error("A valid Monthly Price is required");
      return;
    }

    setLoading(true);
    try {
      const maxUsersValue = parseInt(limits.find(l => l.key === "max_users")?.value || "10", 10);
      const maxShipmentsValue = parseInt(limits.find(l => l.key === "max_shipments")?.value || "1000", 10);
      
      const additionalLimits: Record<string, any> = {};
      limits.forEach(l => {
        if (l.key !== "max_users" && l.key !== "max_shipments") {
          additionalLimits[l.key] = isNaN(Number(l.value)) ? l.value : Number(l.value);
        }
      });

      const payload = {
        code: slug,
        name,
        priceMonthlyUsd: parseFloat(monthlyPrice),
        maxUsers: maxUsersValue,
        maxShipmentsPerMonth: maxShipmentsValue,
        features: {
          description,
          currency,
          sortOrder: parseInt(sortOrder || "0", 10),
          isActive: activeGeneral && activeSettings,
          trialDays: parseInt(trialDays || "0", 10),
          gracePeriodDays: parseInt(gracePeriodDays || "0", 10),
          quarterlyPrice: quarterlyPrice ? parseFloat(quarterlyPrice) : null,
          semiannualPrice: semiannualPrice ? parseFloat(semiannualPrice) : null,
          annualPrice: annualPrice ? parseFloat(annualPrice) : null,
          featuresList,
          additionalLimits,
        }
      };

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Plan "${name}" created successfully!`);
        router.push("/dashboard/saas/plans");
      } else {
        toast.error(data.error || "Failed to create plan");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during plan creation");
    } finally {
      setLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto mt-10">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              This area is restricted to platform super administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50/40 dark:bg-zinc-950/10 min-h-screen">
      
      {/* Title block with back arrow */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/saas/plans")} className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Plan</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscription plans available to organizations.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Input Fields */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* General Card */}
          <Card className="bg-white dark:bg-slate-950/40">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900 flex flex-row items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-base font-semibold">General</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planName" className="font-semibold">Plan Name *</Label>
                  <Input 
                    id="planName" 
                    placeholder="Pro, Enterprise..." 
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug" className="font-semibold">Slug *</Label>
                  <Input 
                    id="slug" 
                    placeholder="pro" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="font-semibold">Description</Label>
                <textarea 
                  id="description" 
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="currency" className="font-semibold">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="USD" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="PKR">PKR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder" className="font-semibold">Sort order</Label>
                  <Input 
                    id="sortOrder" 
                    type="number" 
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between border rounded-md p-2 bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-sm font-semibold">Active</span>
                  <Switch checked={activeGeneral} onCheckedChange={setActiveGeneral} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Card */}
          <Card className="bg-white dark:bg-slate-950/40">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900 flex flex-row items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-base font-semibold">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyPrice" className="font-semibold">Monthly Price *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                  <Input 
                    id="monthlyPrice" 
                    className="pl-7"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarterlyPrice" className="font-semibold">Quarterly Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                  <Input 
                    id="quarterlyPrice" 
                    placeholder="Optional"
                    className="pl-7"
                    value={quarterlyPrice}
                    onChange={(e) => setQuarterlyPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="semiannualPrice" className="font-semibold">Semiannual Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                  <Input 
                    id="semiannualPrice" 
                    placeholder="Optional"
                    className="pl-7"
                    value={semiannualPrice}
                    onChange={(e) => setSemiannualPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="annualPrice" className="font-semibold">Annual Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">$</span>
                  <Input 
                    id="annualPrice" 
                    placeholder="Optional"
                    className="pl-7"
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features Card */}
          <Card className="bg-white dark:bg-slate-950/40">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900 flex flex-row items-center gap-2">
              <Tag className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-base font-semibold">Features</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Features..." 
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddFeature())}
                />
                <Button onClick={handleAddFeature}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Press Enter or + to add a feature</p>

              <div className="space-y-2 mt-4">
                {featuresList.map((feature, idx) => (
                  <div key={idx} className="flex items-center justify-between border rounded-md p-2 bg-slate-50/55 dark:bg-slate-900/40">
                    <span className="text-sm">{feature}</span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveFeature(idx)} className="h-8 w-8 text-rose-500 hover:text-rose-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Limits Card */}
          <Card className="bg-white dark:bg-slate-950/40">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900 flex flex-row items-center gap-2">
              <Sliders className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-base font-semibold">Limits</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                  placeholder="limit_key (e.g. max_users)" 
                  value={newLimitKey}
                  onChange={(e) => setNewLimitKey(e.target.value)}
                />
                <Input 
                  placeholder="value (e.g. 100)" 
                  value={newLimitValue}
                  onChange={(e) => setNewLimitValue(e.target.value)}
                />
                <Button onClick={handleAddLimit} className="shrink-0">
                  <Plus className="h-4 w-4 mr-2" /> Add Limit
                </Button>
              </div>

              <div className="space-y-2 mt-4">
                {limits.map((l) => (
                  <div key={l.key} className="flex items-center justify-between border rounded-md p-2 bg-slate-50/55 dark:bg-slate-900/40 font-mono text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{l.key}</Badge>
                      <span>:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{l.value}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveLimit(l.key)} className="h-8 w-8 text-rose-500 hover:text-rose-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right / Settings & Preview */}
        <div className="space-y-6">
          
          {/* Settings Card */}
          <Card className="bg-white dark:bg-slate-950/40">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-900 flex flex-row items-center gap-2">
              <Settings className="h-5 w-5 text-indigo-500" />
              <CardTitle className="text-base font-semibold">Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trialDays" className="font-semibold">Trial Days</Label>
                <Input 
                  id="trialDays" 
                  type="number" 
                  value={trialDays}
                  onChange={(e) => setTrialDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">0 = no trial period</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gracePeriodDays" className="font-semibold">Grace Period Days</Label>
                <Input 
                  id="gracePeriodDays" 
                  type="number" 
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Days the org can still use the system after expiry before it goes read-only
                </p>
              </div>

              <hr />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Active</span>
                  <Switch checked={activeSettings} onCheckedChange={setActiveSettings} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Inactive plans are not available for new subscriptions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Plan Preview Card */}
          <Card className="border-t-4 border-t-indigo-600 bg-white dark:bg-slate-950/40 shadow-lg">
            <CardHeader className="pb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Plan Preview</span>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-2xl font-bold tracking-tight capitalize">{name || "—"}</h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Slug: {slug || "—"}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">${monthlyPrice || "0.00"}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>

              {description && (
                <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border text-xs">
                  {description}
                </p>
              )}

              {featuresList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Features Included</p>
                  <ul className="space-y-1.5">
                    {featuresList.map((f, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs">
                        <Check className="h-4 w-4 text-green-600 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {limits.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Operational Limits</p>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    {limits.map((l) => (
                      <div key={l.key} className="bg-slate-50 dark:bg-slate-900/50 border p-2 rounded-md">
                        <span className="text-muted-foreground block text-[10px] uppercase">{l.key.replace("max_", "")}</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{l.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-4">
                <Button 
                  onClick={handleCreatePlan} 
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3"
                  disabled={loading}
                >
                  {loading ? "Creating Plan..." : "+ Create Plan"}
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => router.push("/dashboard/saas/plans")} 
                  className="w-full border"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>

      </div>

    </div>
  );
}
