"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { 
  Wallet, Check, Zap, AlertTriangle, Landmark, 
  Smartphone, DollarSign, UploadCloud, Loader2 
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

function UsageBar({ label, used, max }: { label: string; used: number; max: number }) {
  const unlimited = max < 0;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const over = !unlimited && used >= max;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={over ? "font-semibold text-destructive" : ""}>
          {used.toLocaleString()} {unlimited ? "/ ∞" : `/ ${max.toLocaleString()}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full ${over ? "bg-destructive" : pct > 80 ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function BillingPageInner() {
  const searchParams = useSearchParams();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

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

  const upgrade = async (planCode: string) => {
    setCheckoutPlan(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
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
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header section */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
            Plan & Billing
          </h1>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 pl-1">
          Monitor your organization's resource usage, change subscription tiers, or submit local bank transfer proofs.
        </p>
        <hr className="border-slate-100 dark:border-slate-800/40 my-3" />
      </div>

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

      {/* Current plan and usage limits */}
      <Card className="border-slate-200 dark:border-slate-800/60 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Current Plan</p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white capitalize mt-1">
                {subStatus === "trialing" ? "14-Day Free Trial" : plan?.name ?? "—"}
              </h2>
            </div>
            {subStatus && (
              <Badge
                variant={inactive ? "destructive" : subStatus === "trialing" ? "secondary" : "default"}
                className={`capitalize font-bold px-3 py-1 rounded-full ${
                  inactive 
                    ? "bg-rose-50 text-rose-700 border border-rose-200" 
                    : subStatus === "trialing" 
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" 
                      : "bg-indigo-50 text-indigo-700 border border-indigo-250 dark:bg-indigo-950/20 dark:text-indigo-400"
                }`}
              >
                {subStatus === "trialing" ? "trial" : subStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {usage && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-950/10">
                <UsageBar
                  label="Shipments this month"
                  used={usage.shipmentsThisMonth}
                  max={subStatus === "trialing" ? -1 : usage.maxShipmentsPerMonth}
                />
              </div>
              <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-950/10">
                <UsageBar 
                  label="Team members" 
                  used={usage.members} 
                  max={subStatus === "trialing" ? -1 : usage.maxUsers} 
                />
              </div>
              <div className="p-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/40 dark:bg-slate-950/10">
                <UsageBar 
                  label="Branches limit" 
                  used={usage.branches || 0} 
                  max={subStatus === "trialing" ? -1 : (usage.maxBranches || 0)} 
                />
              </div>
            </div>
          )}
          {trialEnds && subStatus === "trialing" && !trialExpired && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/20 px-3 py-2 rounded-xl inline-block">
              Trial ends on {trialEnds.toLocaleDateString()}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Options List */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select a Plan</h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
          {plans.map((p) => {
            const isCurrent = plan?.code === p.code;
            const isGrowth = p.code === "growth";
            return (
              <Card 
                key={p.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-lg rounded-2xl border flex flex-col ${
                  isCurrent 
                    ? "border-indigo-600 bg-white dark:bg-slate-900 shadow-md shadow-indigo-500/5" 
                    : isGrowth 
                      ? "border-indigo-500/50 bg-white dark:bg-slate-900 shadow-sm" 
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                {isGrowth && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                    Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lg text-slate-900 dark:text-white capitalize">{p.name}</p>
                    {isCurrent && (
                      <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-full font-bold text-[10px] border border-indigo-105">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">
                    {(() => {
                      const currency = (p.features as any)?.currency || "PKR";
                      if (currency === "USD") return `$${p.priceMonthlyUsd.toFixed(2)}`;
                      if (currency === "EUR") return `€${p.priceMonthlyUsd.toFixed(2)}`;
                      if (currency === "GBP") return `£${p.priceMonthlyUsd.toFixed(2)}`;
                      return `${currency} ${p.priceMonthlyUsd.toLocaleString()}`;
                    })()}
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">/month</span>
                  </p>
                  {(() => {
                    const discountPercent = (p.features as any)?.yearlyDiscountPercent !== undefined 
                      ? parseFloat((p.features as any).yearlyDiscountPercent) 
                      : 20;
                    return (
                      <div className="mt-1">
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-950/20 px-2.5 py-0.5 rounded-full inline-block">
                          Save {discountPercent}% on yearly
                        </span>
                      </div>
                    );
                  })()}
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-between pt-0">
                  <ul className="space-y-2.5 text-sm py-2">
                    <li className="flex items-start gap-2.5">
                      <Check className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-300 text-xs">
                        {p.maxShipmentsPerMonth <= 0
                          ? "Unlimited shipments"
                          : `${p.maxShipmentsPerMonth.toLocaleString()} shipments / mo`}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-300 text-xs">
                        {p.maxUsers <= 0 ? "Unlimited members" : `${p.maxUsers} team members`}
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600 dark:text-slate-300 text-xs">
                        {(() => {
                          const mb = (p.features as { maxBranches?: number })?.maxBranches;
                          const resolvedBranches = mb !== undefined ? mb : (p.code === "starter" ? 1 : p.code === "growth" ? 3 : 5);
                          return `${resolvedBranches} branches allowance`;
                        })()}
                      </span>
                    </li>
                    {(p.features as { map?: boolean })?.map && (
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 dark:text-slate-300 text-xs">Remote Area Lookup</span>
                      </li>
                    )}
                    {(p.features as { accounts?: boolean })?.accounts && (
                      <li className="flex items-start gap-2.5">
                        <Check className="h-4.5 w-4.5 text-green-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 dark:text-slate-300 text-xs">Accounting Ledger</span>
                      </li>
                    )}
                  </ul>
                  <Button
                    className={`w-full mt-4 py-5 rounded-xl font-bold cursor-pointer transition-all ${
                      isCurrent
                        ? "bg-slate-100 hover:bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                        : isGrowth
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-950 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200 shadow-md"
                    }`}
                    disabled={!canManage || isCurrent || checkoutPlan !== null}
                    onClick={() => upgrade(p.code)}
                  >
                    <Zap className="h-4 w-4 shrink-0 mr-1.5" />
                    {isCurrent
                      ? "Current Plan"
                      : checkoutPlan === p.code
                      ? "Redirecting…"
                      : "Upgrade Plan"}
                  </Button>
                </CardContent>
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
                className="w-full mt-4 h-11 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-500/10 cursor-pointer" 
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
