"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { 
  Wallet, Check, Zap, AlertTriangle, Landmark, 
  Smartphone, DollarSign, UploadCloud, Loader2,
  MoreVertical, Sparkles
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

type Usage = {
  shipmentsThisMonth: number;
  maxShipmentsPerMonth: number; // -1 = unlimited
  members: number;
  maxUsers: number; // -1 = unlimited
  branches?: number;
  maxBranches?: number;
};

type PlanInfo = {
  code: string;
  name: string;
  maxShipmentsPerMonth: number;
  maxUsers: number;
  features: Record<string, unknown>;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
};

type Plan = {
  id: number;
  code: string;
  name: string;
  priceMonthlyUsd: number;
  maxUsers: number;
  maxShipmentsPerMonth: number;
  features: Record<string, unknown>;
};

const MANAGE_ROLES = ["OWNER", "ADMIN"];

function CircularProgress({ used, max, label }: { used: number; max: number; label: string }) {
  const unlimited = max < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = unlimited ? 0 : circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="w-12 h-12 transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800 fill-none"
            strokeWidth="3.5"
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            className={`fill-none transition-all duration-500 ${pct >= 100 ? "stroke-rose-500" : pct > 80 ? "stroke-amber-500" : "stroke-indigo-600"}`}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-200">
          {unlimited ? "∞" : `${pct}%`}
        </span>
      </div>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
        {label}
      </span>
      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">
        {used} / {unlimited ? "∞" : max}
      </span>
    </div>
  );
}

const getChecklistForPlan = (plan: any): string[] => {
  if (plan.features && Array.isArray(plan.features.featuresList) && plan.features.featuresList.length > 0) {
    return plan.features.featuresList;
  }
  const code = plan.code;
  switch (code) {
    case "starter":
      return ["100 shipments/month", "1 user limit", "1 branch limit", "All core features", "Excludes Remote Area & Finances"];
    case "growth":
      return ["300 shipments/month", "5 users limit", "3 branches limit", "Remote Area Lookup included", "Excludes Finances"];
    case "pro":
      return ["500 shipments/month", "10 users limit", "5 branches limit", "Remote Area Lookup included", "Finances & Reports included", "All features enabled"];
    case "pro-plus":
    case "pro+":
      return ["Unlimited shipments", "Unlimited users", "Unlimited branches", "Remote Area Lookup included", "Finances & Reports included", "Dedicated Support", "All features enabled"];
    default:
      return [];
  }
};

function BillingPageInner() {
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Manual payment states
  const [manualPlan, setManualPlan] = useState("");
  const [manualMethod, setManualMethod] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualRefId, setManualRefId] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submittingProof, setSubmittingProof] = useState(false);

  const canManage = MANAGE_ROLES.includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [usageRes, plansRes] = await Promise.all([
        fetch("/api/org/usage"),
        fetch("/api/plans"),
      ]);
      const usageData = await usageRes.json();
      const plansData = await plansRes.json();
      if (!usageRes.ok) throw new Error(usageData.error || "Failed to load usage");
      setUsage(usageData.usage);
      setPlan(usageData.plan);
      setRole(usageData.role || "");
      if (plansRes.ok) {
        const filteredPlans = (plansData.plans ?? []).filter((p: any) => p.code !== "trial" && p.code !== "free");
        setPlans(filteredPlans);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const status = searchParams.get("checkout");
    if (status === "success") toast.success("Payment successful — your plan is being activated.");
    if (status === "cancelled") toast("Checkout cancelled.");
  }, [searchParams]);

  const upgrade = async (planCode: string, period?: "monthly" | "yearly") => {
    const cycle = period || billingPeriod;
    setCheckoutPlan(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingCycle: cycle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
      setCheckoutPlan(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setReceiptUrl(data.url);
      toast.success("Receipt screenshot uploaded successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPlan || !manualMethod || !manualAmount || !manualRefId) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmittingProof(true);
    try {
      const res = await fetch("/api/billing/manual-payment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode: manualPlan,
          amount: parseFloat(manualAmount),
          method: manualMethod,
          referenceId: manualRefId,
          receiptUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit proof");
      toast.success("Payment proof submitted successfully! Super-admin will review and activate your subscription.");
      
      // Reset form
      setManualPlan("");
      setManualMethod("");
      setManualAmount("");
      setManualRefId("");
      setReceiptUrl("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit proof");
    } finally {
      setSubmittingProof(false);
    }
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const subStatus = plan?.subscriptionStatus ?? null;
  const trialEnds = plan?.trialEndsAt ? new Date(plan.trialEndsAt) : null;
  const trialExpired = subStatus === "trialing" && trialEnds && trialEnds.getTime() < Date.now();
  const inactive = subStatus === "past_due" || subStatus === "canceled";

  // Quick helper to format prices with custom currency
  const getPlanPriceLabel = (p: any) => {
    const currency = (p.features as any)?.currency || "PKR";
    const price = p.priceMonthlyUsd || 0;
    if (currency === "USD") return `$${price} / month`;
    if (currency === "EUR") return `€${price} / month`;
    if (currency === "GBP") return `£${price} / month`;
    return `${currency} ${price.toLocaleString()} / month`;
  };

  return (
    <div className="p-6 space-y-8 w-full">
      {/* Header section with top-right current plan circular indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Wallet className="h-7 w-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
              Plan & Billing
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 pl-1">
            Monitor organization limits, change subscription tiers, or submit local bank transfer proofs.
          </p>
        </div>

        {/* Top-right Current Plan & Limits card */}
        {usage && (
          <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm shadow-sm rounded-2xl p-4 shrink-0 flex items-center gap-6">
            <div className="flex items-center gap-4">
              <CircularProgress
                label="Shipments"
                used={usage.shipmentsThisMonth}
                max={subStatus === "trialing" ? -1 : usage.maxShipmentsPerMonth}
              />
              <CircularProgress
                label="Members"
                used={usage.members}
                max={subStatus === "trialing" ? -1 : usage.maxUsers}
              />
              <CircularProgress
                label="Branches"
                used={usage.branches || 0}
                max={subStatus === "trialing" ? -1 : (usage.maxBranches || 0)}
              />
            </div>
            <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="flex flex-col justify-center pl-1">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Current Plan</p>
              <p className="text-sm font-black text-slate-800 dark:text-white capitalize mt-0.5">
                {subStatus === "trialing" ? "Free Trial" : plan?.name ?? "—"}
              </p>
              {subStatus && (
                <Badge className="mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 w-max">
                  {subStatus === "trialing" ? "trial" : subStatus}
                </Badge>
              )}
            </div>
          </Card>
        )}
      </div>
      <hr className="border-slate-200/60 dark:border-slate-800/40 my-3" />

      {(trialExpired || inactive) && (
        <Card className="border-rose-200 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/10 rounded-2xl overflow-hidden shadow-sm">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
            <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
              {inactive
                ? "Your subscription is inactive. Choose a plan or submit local payment proof below to restore full access."
                : "Your free trial has ended. Choose a plan or submit local payment proof below to keep creating shipments."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Tiers Header & Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upgrade Tiers</h2>
          {!canManage ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Only organization owners and administrators can change subscription plans.
            </p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Choose a subscription tier that fits your shipping operations.
            </p>
          )}
        </div>

        {/* Tab-style interval toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto border border-slate-200/20">
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              billingPeriod === "monthly"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("yearly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              billingPeriod === "yearly"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Yearly
            <span className="text-[9px] text-green-600 dark:text-green-400 font-extrabold bg-green-50 dark:bg-green-950/20 px-1 py-0.5 rounded">
              Save 15%
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
          {plans.map((p) => {
            const isCurrent = plan?.code === p.code;
            const isGrowth = p.code === "growth";
            const description = (p.features as any)?.description || "";

            const discountPercent = (p.features as any)?.yearlyDiscountPercent !== undefined 
              ? parseFloat((p.features as any).yearlyDiscountPercent) 
              : 15;

            const currency = (p.features as any)?.currency || "PKR";
            const baseMonthlyPrice = p.priceMonthlyUsd;
            const yearlyDiscountedMonthlyPrice = baseMonthlyPrice * (1 - (discountPercent / 100));
            const activePrice = billingPeriod === "yearly" ? yearlyDiscountedMonthlyPrice : baseMonthlyPrice;

            let formattedPrice = "";
            if (currency === "USD") formattedPrice = `$${activePrice.toFixed(2)}`;
            else if (currency === "EUR") formattedPrice = `€${activePrice.toFixed(2)}`;
            else if (currency === "GBP") formattedPrice = `£${activePrice.toFixed(2)}`;
            else formattedPrice = `${currency} ${Math.round(activePrice).toLocaleString()}`;

            const calculatedAnnualPrice = p.priceMonthlyUsd * 12 * (1 - (discountPercent / 100));
            let formattedAnnualPrice = "";
            if (currency === "USD") formattedAnnualPrice = `$${calculatedAnnualPrice.toFixed(1)}`;
            else if (currency === "EUR") formattedAnnualPrice = `€${calculatedAnnualPrice.toFixed(1)}`;
            else if (currency === "GBP") formattedAnnualPrice = `£${calculatedAnnualPrice.toFixed(1)}`;
            else formattedAnnualPrice = `${currency} ${Math.round(calculatedAnnualPrice).toLocaleString()}`;

            return (
              <Card 
                key={p.id} 
                className={`relative flex flex-col justify-between p-5 transition-all duration-300 rounded-2xl ${
                  isCurrent 
                    ? "border-2 border-indigo-600 dark:border-indigo-500 shadow-xl bg-slate-50/50 dark:bg-slate-950/45 backdrop-blur-md" 
                    : isGrowth 
                      ? "border border-indigo-500/50 dark:border-indigo-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-slate-50/50 dark:bg-slate-950/45 backdrop-blur-md" 
                      : "border border-slate-200 dark:border-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.04)] bg-slate-50/50 dark:bg-slate-955/45 backdrop-blur-md hover:border-indigo-500/50 dark:hover:border-indigo-500/30 hover:shadow-[0_15px_35px_rgba(99,102,241,0.08)]"
                }`}
              >
                {isGrowth && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-3.5 py-1.5 rounded-full uppercase flex items-center gap-1 shadow-md shadow-indigo-500/10">
                    <Sparkles className="w-3 h-3 fill-white" /> Popular
                  </div>
                )}

                <div className="space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-base text-gray-900 dark:text-white capitalize">{p.name}</span>
                        {isCurrent && (
                          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 rounded-full font-bold text-[9px] border border-emerald-100 uppercase tracking-wider px-2 py-0.5 animate-pulse">
                            Active
                          </Badge>
                        )}
                      </div>
                      <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-250 cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                    {description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[28px] leading-normal">{description}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                        {formattedPrice}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">/month</span>
                    </div>
                    {billingPeriod === "yearly" ? (
                      <p className="text-[10px] text-green-650 dark:text-green-400 font-bold mt-1">
                        Billed annually as {formattedAnnualPrice}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold flex items-center justify-start flex-wrap gap-1">
                        <span>{formattedAnnualPrice}/year</span>
                        <span className="text-green-650 dark:text-green-400 font-bold ml-0.5">(save {discountPercent}%)</span>
                      </p>
                    )}
                  </div>

                  <hr className="border-slate-100 dark:border-slate-800/50 my-1" />

                  <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400 flex-1 py-1">
                    {getChecklistForPlan(p).map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full mt-4 py-3.5 rounded-xl font-bold cursor-pointer transition-all ${
                      isCurrent
                        ? "bg-slate-100 hover:bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-205 dark:border-slate-700"
                        : isGrowth
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-950 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 shadow-md"
                    }`}
                    disabled={!canManage || isCurrent || checkoutPlan !== null}
                    onClick={() => upgrade(p.code, billingPeriod)}
                  >
                    {checkoutPlan === p.code ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <Zap className="h-4 w-4 shrink-0 mr-1.5" />
                    )}
                    {isCurrent
                      ? "Current Plan"
                      : checkoutPlan === p.code
                      ? "Redirecting…"
                      : "Upgrade Plan"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {canManage && (
        <Card className="border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Pay via Local Transfer
            </CardTitle>
            <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
              Transfer subscription fee directly to our regional accounts in Pakistan and upload your proof of payment for manual activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Account Details Column */}
            <div className="space-y-4 pr-0 md:pr-6 md:border-r border-slate-100 dark:border-slate-800/85">
              <h3 className="font-bold text-xs uppercase text-slate-400 dark:text-slate-500 tracking-wider">Our Accounts</h3>
              
              <div className="p-4 border border-emerald-500/10 rounded-2xl bg-gradient-to-br from-emerald-600/90 to-teal-850 text-white shadow-md relative overflow-hidden group">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-10">
                  <Landmark className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between font-bold text-base">
                  <span>Meezan Bank</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Main Account</span>
                </div>
                <div className="text-xs space-y-1.5 mt-4 font-mono">
                  <p><span className="opacity-70">Title:</span> PSS ERP Solutions</p>
                  <p><span className="opacity-70">Account:</span> 1209-082498234</p>
                  <p><span className="opacity-70">IBAN:</span> PK73MEZN1209082498234</p>
                </div>
              </div>

              <div className="p-4 border border-green-500/10 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-25px] opacity-15">
                  <Smartphone className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between font-bold text-base">
                  <span>Easypaisa</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Mobile Wallet</span>
                </div>
                <div className="text-xs space-y-1.5 mt-4 font-mono">
                  <p><span className="opacity-70">Title:</span> Zeeshan Ahmad</p>
                  <p><span className="opacity-70">Number:</span> 0300-1234567</p>
                </div>
              </div>

              <div className="p-4 border border-amber-500/10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-25px] opacity-15">
                  <Smartphone className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between font-bold text-base">
                  <span>JazzCash</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Mobile Wallet</span>
                </div>
                <div className="text-xs space-y-1.5 mt-4 font-mono">
                  <p><span className="opacity-70">Title:</span> Zeeshan Ahmad</p>
                  <p><span className="opacity-70">Number:</span> 0310-7654321</p>
                </div>
              </div>

              <div className="p-4 border border-indigo-500/10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-700 text-white shadow-md relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-20px] opacity-15">
                  <DollarSign className="w-32 h-32" />
                </div>
                <div className="flex items-center justify-between font-bold text-base">
                  <span>Cash Payment</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Direct</span>
                </div>
                <p className="text-xs mt-3 opacity-90 leading-relaxed font-semibold">
                  Contact platform super-admin directly at pss-admin@gmail.com for physical cash settlement.
                </p>
              </div>
            </div>

            {/* Submission Form Column */}
            <form onSubmit={handleManualSubmit} className="space-y-4 pl-0 md:pl-2">
              <h3 className="font-bold text-xs uppercase text-slate-400 dark:text-slate-500 tracking-wider">Submit Payment Proof</h3>
              
              <div className="space-y-1">
                <Label htmlFor="planSelect" className="text-xs font-bold text-slate-600 dark:text-slate-400">Target Plan</Label>
                <Select value={manualPlan} onValueChange={setManualPlan}>
                  <SelectTrigger id="planSelect" className="h-11 rounded-xl bg-slate-50 dark:bg-slate-955 border-slate-205 dark:border-slate-800">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                    {plans.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        <span className="capitalize">{p.name}</span> ({getPlanPriceLabel(p)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="methodSelect" className="text-xs font-bold text-slate-600 dark:text-slate-400">Payment Method</Label>
                <Select value={manualMethod} onValueChange={setManualMethod}>
                  <SelectTrigger id="methodSelect" className="h-11 rounded-xl bg-slate-50 dark:bg-slate-955 border-slate-205 dark:border-slate-800">
                    <SelectValue placeholder="Select transfer method" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-955">
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
                    <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="amount" className="text-xs font-bold text-slate-600 dark:text-slate-400">Amount Paid (PKR)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="e.g. 14000" 
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-955 border-slate-205 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="refId" className="text-xs font-bold text-slate-600 dark:text-slate-400">Transaction ID / Ref #</Label>
                  <Input 
                    id="refId" 
                    type="text" 
                    placeholder="TID / Ref No" 
                    value={manualRefId}
                    onChange={(e) => setManualRefId(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-slate-50 dark:bg-slate-955 border-slate-205 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt" className="text-xs font-bold text-slate-600 dark:text-slate-400">Receipt Screenshot</Label>
                <div className="flex items-center gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="relative cursor-pointer h-11 px-5 rounded-xl border-slate-200 dark:border-slate-800"
                    disabled={uploading}
                    asChild
                  >
                    <label className="flex items-center gap-2 cursor-pointer">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      <span>{receiptUrl ? "Change File" : "Upload File"}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileUpload} 
                        disabled={uploading}
                      />
                    </label>
                  </Button>
                  {receiptUrl ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                      <Check className="h-4 w-4" /> Screenshot uploaded
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Supported format: PNG, JPG</span>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-4 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/10 cursor-pointer" 
                disabled={submittingProof || uploading}
              >
                {submittingProof ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    <span>Submitting proof...</span>
                  </>
                ) : (
                  "Submit Proof"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading…</div>}>
      <BillingPageInner />
    </Suspense>
  );
}
