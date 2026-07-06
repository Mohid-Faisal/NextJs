"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Layers, ShieldAlert, Plus, Check, RefreshCw, 
  MoreVertical, Edit2, ToggleLeft, ToggleRight, Users, Clock, AlertCircle, Trash2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type Plan = {
  id: number;
  code: string;
  name: string;
  priceMonthlyUsd: number;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  features: any;
  _count?: {
    subscriptions: number;
  };
};

interface DecodedToken {
  platformRole?: string | null;
}

export default function SaasPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Edit Modal States
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editName, setEditName] = useState("");
  const [editPriceMonthly, setEditPriceMonthly] = useState("");
  const [editPriceAnnual, setEditPriceAnnual] = useState("");
  const [editMaxUsers, setEditMaxUsers] = useState("");
  const [editMaxShipments, setEditMaxShipments] = useState("");
  const [editMaxBranches, setEditMaxBranches] = useState("");
  const [editCurrency, setEditCurrency] = useState("PKR");
  const [editDescription, setEditDescription] = useState("");
  const [editFeaturesList, setEditFeaturesList] = useState("");
  const [editTrialDays, setEditTrialDays] = useState("");
  const [editGracePeriodDays, setEditGracePeriodDays] = useState("");
  const [editAccounts, setEditAccounts] = useState(false);
  const [editBulkUpload, setEditBulkUpload] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  
  // Custom features states
  const [editMap, setEditMap] = useState(false);
  const [editAnalytics, setEditAnalytics] = useState(false);
  const [editActivityLogs, setEditActivityLogs] = useState(false);
  const [editCustomersPage, setEditCustomersPage] = useState(false);
  const [editVendorsPage, setEditVendorsPage] = useState(false);
  const [editRecipientsPage, setEditRecipientsPage] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  const loadPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (res.ok) {
        setPlans(data.plans || []);
      } else {
        toast.error("Failed to load plans");
      }
    } catch {
      toast.error("An error occurred loading plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadPlans();
    }
  }, [isSuperAdmin]);

  const startEdit = (plan: Plan) => {
    const features = plan.features || {};
    setEditingPlan(plan);
    setEditName(plan.name);
    setEditPriceMonthly(String(plan.priceMonthlyUsd));
    setEditPriceAnnual(String(features.annualPrice ?? (plan.priceMonthlyUsd * 10 * 1.2)));
    setEditMaxUsers(String(plan.maxUsers));
    setEditMaxShipments(String(plan.maxShipmentsPerMonth));
    setEditMaxBranches(String(features.maxBranches ?? (plan.code === "starter" ? 1 : plan.code === "growth" ? 3 : 5)));
    setEditCurrency(features.currency ?? "PKR");
    setEditDescription(features.description ?? "");
    setEditFeaturesList(Array.isArray(features.featuresList) ? features.featuresList.join("\n") : "");
    setEditTrialDays(String(features.trialDays ?? 14));
    setEditGracePeriodDays(String(features.gracePeriodDays ?? 7));
    setEditAccounts(features.accounts === true);
    setEditBulkUpload(features.bulkUpload === true);
    setEditIsActive(features.isActive !== false);

    // Populate custom features
    setEditMap(features.map === true);
    setEditAnalytics(features.analytics === true);
    setEditActivityLogs(features.activityLogs === true);
    setEditCustomersPage(features.customersPage === true);
    setEditVendorsPage(features.vendorsPage === true);
    setEditRecipientsPage(features.recipientsPage === true);
  };

  const savePlanEdit = async () => {
    if (!editName.trim()) {
      toast.error("Plan name is required");
      return;
    }
    if (
      isNaN(Number(editPriceMonthly)) || 
      isNaN(Number(editPriceAnnual)) || 
      isNaN(Number(editMaxUsers)) || 
      isNaN(Number(editMaxShipments)) || 
      isNaN(Number(editMaxBranches)) || 
      isNaN(Number(editTrialDays)) || 
      isNaN(Number(editGracePeriodDays))
    ) {
      toast.error("Please enter valid numeric values");
      return;
    }

    try {
      const features = editingPlan?.features || {};
      const updatedPayload = {
        name: editName.trim(),
        priceMonthlyUsd: parseFloat(editPriceMonthly),
        maxUsers: parseInt(editMaxUsers, 10),
        maxShipmentsPerMonth: parseInt(editMaxShipments, 10),
        features: {
          ...features,
          trialDays: parseInt(editTrialDays, 10),
          gracePeriodDays: parseInt(editGracePeriodDays, 10),
          accounts: editAccounts,
          bulkUpload: editBulkUpload,
          isActive: editIsActive,
          annualPrice: parseFloat(editPriceAnnual),
          maxBranches: parseInt(editMaxBranches, 10),
          currency: editCurrency.trim() || "PKR",
          description: editDescription.trim(),
          featuresList: editFeaturesList.split("\n").map(f => f.trim()).filter(Boolean),
          map: editMap,
          analytics: editAnalytics,
          activityLogs: editActivityLogs,
          customersPage: editCustomersPage,
          vendorsPage: editVendorsPage,
          recipientsPage: editRecipientsPage,
        }
      };

      const res = await fetch(`/api/plans/${editingPlan?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPayload)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Plan "${editName}" updated successfully!`);
        setEditingPlan(null);
        loadPlans();
      } else {
        toast.error(data.error || "Failed to update plan");
      }
    } catch {
      toast.error("An error occurred during plan update");
    }
  };

  const togglePlanActive = async (plan: Plan) => {
    const features = plan.features || {};
    const currentlyActive = features.isActive !== false;
    const nextActiveState = !currentlyActive;

    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: {
            ...features,
            isActive: nextActiveState
          }
        })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Plan is now ${nextActiveState ? "active" : "inactive"}`);
        loadPlans();
      } else {
        toast.error(data.error || "Failed to toggle status");
      }
    } catch {
      toast.error("An error occurred");
    }
  };

  const handleDeletePlan = async (planId: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the plan "${name}"?`)) return;
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Plan "${name}" has been deleted successfully.`);
        loadPlans();
      } else {
        toast.error(data.error || "Failed to delete plan.");
      }
    } catch {
      toast.error("An error occurred trying to delete the plan.");
    }
  };

  if (!mounted) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground animate-pulse font-medium">Loading plans...</p>
      </div>
    );
  }

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
      
      {/* Premium Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push("/dashboard")} 
            className="rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Plans</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage subscription plans available to organizations.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadPlans} className="bg-white dark:bg-slate-900 shadow-sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/dashboard/saas/plans/create">
            <Button size="sm" className="bg-[#4F46E5] hover:bg-[#4338CA] text-white shadow-md">
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid Layout matching target design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const features = plan.features || {};
          const isActive = features.isActive !== false;
          const trialDays = features.trialDays ?? 14;
          const annualPrice = features.annualPrice ?? (plan.priceMonthlyUsd * 12 * 0.8);
          const subCount = plan._count?.subscriptions ?? 0;

          return (
            <Card 
              key={plan.id} 
              className={`bg-white dark:bg-slate-900/40 shadow-sm hover:shadow-md transition-all border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between ${!isActive ? "opacity-75" : ""}`}
            >
              <div className="p-6 space-y-4">
                
                {/* Header Row */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{plan.name}</h3>
                    <code className="text-xs text-muted-foreground block mt-0.5">{plan.code}</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={isActive ? "default" : "secondary"} className={isActive ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30" : ""}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                    
                    {/* Action Dropdown Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem onClick={() => startEdit(plan)} className="cursor-pointer gap-2">
                          <Edit2 className="h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePlanActive(plan)} className="cursor-pointer gap-2">
                          {isActive ? (
                            <>
                              <ToggleLeft className="h-3.5 w-3.5 text-slate-500" /> Deactivate
                            </>
                          ) : (
                            <>
                              <ToggleRight className="h-3.5 w-3.5 text-emerald-500" /> Activate
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeletePlan(plan.id, plan.name)} className="cursor-pointer gap-2 text-destructive focus:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Pricing Block */}
                <div className="pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {(() => {
                        const currency = features.currency || "PKR";
                        if (currency === "USD") return `$${plan.priceMonthlyUsd.toFixed(2)}`;
                        if (currency === "EUR") return `€${plan.priceMonthlyUsd.toFixed(2)}`;
                        if (currency === "GBP") return `£${plan.priceMonthlyUsd.toFixed(2)}`;
                        return `${currency} ${plan.priceMonthlyUsd.toLocaleString()}`;
                      })()}
                    </span>
                    <span className="text-xs text-muted-foreground">/monthly</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mt-1">
                    {(() => {
                      const currency = features.currency || "PKR";
                      if (currency === "USD") return `$${annualPrice.toFixed(2)}`;
                      if (currency === "EUR") return `€${annualPrice.toFixed(2)}`;
                      if (currency === "GBP") return `£${annualPrice.toFixed(2)}`;
                      return `${currency} ${annualPrice.toLocaleString()}`;
                    })()}/annual
                  </span>
                </div>

                {/* Divider Line */}
                <hr className="border-slate-100 dark:border-slate-800" />

                {/* Limits & Features Checklist */}
                <div className="space-y-2 pt-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-between">
                    <span>Max Users/Staff:</span>
                    <span className="font-semibold">{plan.maxUsers}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max Shipments/mo:</span>
                    <span className="font-semibold">{plan.maxShipmentsPerMonth.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max Branches limit:</span>
                    <span className="font-semibold">
                      {features.maxBranches !== undefined ? features.maxBranches : (plan.code === "starter" ? 1 : plan.code === "growth" ? 3 : 5)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Accounting Module:</span>
                    <span className={`font-semibold ${features.accounts ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                      {features.accounts ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bulk Actions:</span>
                    <span className={`font-semibold ${features.bulkUpload ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                      {features.bulkUpload ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Interactive Map:</span>
                    <span className={`font-semibold ${features.map ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                      {features.map ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Analytics & Charts:</span>
                    <span className={`font-semibold ${features.analytics ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                      {features.analytics ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Activity Audit Logs:</span>
                    <span className={`font-semibold ${features.activityLogs ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`}>
                      {features.activityLogs ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

              </div>

              {/* Card Footer matching target design */}
              <div className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800/80 px-6 py-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>{subCount} Subscriptions</span>
                </div>
                {trialDays > 0 && (
                  <div className="flex items-center gap-1 font-medium bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100/30">
                    <Clock className="h-3 w-3" />
                    <span>{trialDays}d Free Trial</span>
                  </div>
                )}
              </div>

            </Card>
          );
        })}
      </div>

      {/* Fully Functional Edit Plan Modal Dialog */}
      <Dialog open={editingPlan !== null} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Edit subscription plan</DialogTitle>
            <DialogDescription className="text-slate-500">
              Configure properties, operational limits, and granular modules for <strong>{editingPlan?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="editName" className="font-semibold text-slate-800 dark:text-slate-200">Plan Name</Label>
              <Input 
                id="editName" 
                value={editName} 
                onChange={(e) => setEditName(e.target.value)} 
                placeholder="e.g. Starter, Business" 
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editCurrency" className="font-semibold text-slate-800 dark:text-slate-200">Currency</Label>
                <Input 
                  id="editCurrency" 
                  value={editCurrency} 
                  onChange={(e) => setEditCurrency(e.target.value)} 
                  placeholder="e.g. PKR, USD" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPriceMonthly" className="font-semibold text-slate-800 dark:text-slate-200">Monthly Price</Label>
                <Input 
                  id="editPriceMonthly" 
                  value={editPriceMonthly} 
                  onChange={(e) => setEditPriceMonthly(e.target.value)} 
                  type="number"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPriceAnnual" className="font-semibold text-slate-800 dark:text-slate-200">Annual Price</Label>
                <Input 
                  id="editPriceAnnual" 
                  value={editPriceAnnual} 
                  onChange={(e) => setEditPriceAnnual(e.target.value)} 
                  type="number"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editMaxUsers" className="font-semibold text-slate-800 dark:text-slate-200">Max Users Limit</Label>
                <Input 
                  id="editMaxUsers" 
                  value={editMaxUsers} 
                  onChange={(e) => setEditMaxUsers(e.target.value)} 
                  type="number" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editMaxShipments" className="font-semibold text-slate-800 dark:text-slate-200">Max Shipments/mo</Label>
                <Input 
                  id="editMaxShipments" 
                  value={editMaxShipments} 
                  onChange={(e) => setEditMaxShipments(e.target.value)} 
                  type="number" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editMaxBranches" className="font-semibold text-slate-800 dark:text-slate-200">Max Branches Limit</Label>
                <Input 
                  id="editMaxBranches" 
                  value={editMaxBranches} 
                  onChange={(e) => setEditMaxBranches(e.target.value)} 
                  type="number" 
                />
              </div>
              <div className="space-y-1.5">
                {/* Empty spacer to align layout */}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editDescription" className="font-semibold text-slate-800 dark:text-slate-200">Plan Description</Label>
              <Textarea 
                id="editDescription" 
                value={editDescription} 
                onChange={(e) => setEditDescription(e.target.value)} 
                placeholder="e.g. Starter Plan: 100 shipments/mo, 1 user limit." 
                rows={2}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editFeaturesList" className="font-semibold text-slate-800 dark:text-slate-200">Plan Checklist Features (one per line)</Label>
              <Textarea 
                id="editFeaturesList" 
                value={editFeaturesList} 
                onChange={(e) => setEditFeaturesList(e.target.value)} 
                placeholder="e.g.&#10;100 shipments/month&#10;1 user limit&#10;1 branch limit" 
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editTrialDays" className="font-semibold text-slate-800 dark:text-slate-200">Trial Days</Label>
                <Input 
                  id="editTrialDays" 
                  value={editTrialDays} 
                  onChange={(e) => setEditTrialDays(e.target.value)} 
                  type="number" 
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editGracePeriodDays" className="font-semibold text-slate-800 dark:text-slate-200">Grace Period Days</Label>
                <Input 
                  id="editGracePeriodDays" 
                  value={editGracePeriodDays} 
                  onChange={(e) => setEditGracePeriodDays(e.target.value)} 
                  type="number" 
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Features Configuration</span>
              
              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Accounts & Billing</span>
                  <span className="text-xs text-muted-foreground block">Enable invoicing, ledger, and accounting modules.</span>
                </div>
                <Switch checked={editAccounts} onCheckedChange={setEditAccounts} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Bulk Upload & Delete</span>
                  <span className="text-xs text-muted-foreground block">Allow uploading CSV lists and batch actions.</span>
                </div>
                <Switch checked={editBulkUpload} onCheckedChange={setEditBulkUpload} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Interactive Map</span>
                  <span className="text-xs text-muted-foreground block">Unlock real-time shipments geo-mapping tracking.</span>
                </div>
                <Switch checked={editMap} onCheckedChange={setEditMap} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Analytics & Charts</span>
                  <span className="text-xs text-muted-foreground block">Display detailed KPI statistics and graphs.</span>
                </div>
                <Switch checked={editAnalytics} onCheckedChange={setEditAnalytics} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Activity Audit Logs</span>
                  <span className="text-xs text-muted-foreground block">Keep records of user audits and system logs.</span>
                </div>
                <Switch checked={editActivityLogs} onCheckedChange={setEditActivityLogs} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Customers Module</span>
                  <span className="text-xs text-muted-foreground block">Enable customers directory and actions.</span>
                </div>
                <Switch checked={editCustomersPage} onCheckedChange={setEditCustomersPage} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Vendors Module</span>
                  <span className="text-xs text-muted-foreground block">Enable vendors database and profiles.</span>
                </div>
                <Switch checked={editVendorsPage} onCheckedChange={setEditVendorsPage} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Recipients Module</span>
                  <span className="text-xs text-muted-foreground block">Enable recipients directory tracking.</span>
                </div>
                <Switch checked={editRecipientsPage} onCheckedChange={setEditRecipientsPage} />
              </div>

              <div className="flex items-center justify-between border border-slate-150 rounded-xl p-3 bg-slate-50/50 dark:bg-zinc-800/10">
                <div className="space-y-0.5">
                  <span className="text-sm font-semibold block">Active status</span>
                  <span className="text-xs text-muted-foreground block">Determine if this plan is visible to new users.</span>
                </div>
                <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
              </div>
            </div>

          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditingPlan(null)} className="border">
              Cancel
            </Button>
            <Button onClick={savePlanEdit} className="bg-[#4F46E5] hover:bg-[#4338CA] text-white">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
