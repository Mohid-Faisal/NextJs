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
      if (plansRes.ok) setPlans(plansData.plans ?? []);
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

  // Quick helper to approximate PKR prices for local bank transfers
  const getPKRPriceLabel = (planCode: string) => {
    if (planCode === "starter") return "Rs. 14,000 / month";
    if (planCode === "business") return "Rs. 28,000 / month";
    if (planCode === "pro") return "Rs. 56,000 / month";
    return "";
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
      </div>

      {(trialExpired || inactive) && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">
              {inactive
                ? "Your subscription is inactive. Choose a plan or submit local payment proof below to restore full access."
                : "Your free trial has ended. Choose a plan or submit local payment proof below to keep creating shipments."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Current plan</p>
              <p className="text-sm text-muted-foreground capitalize">{plan?.name ?? "—"}</p>
            </div>
            {subStatus && (
              <Badge
                variant={inactive ? "destructive" : subStatus === "trialing" ? "secondary" : "default"}
                className="capitalize"
              >
                {subStatus}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {usage && (
            <>
              <UsageBar
                label="Shipments this month"
                used={usage.shipmentsThisMonth}
                max={usage.maxShipmentsPerMonth}
              />
              <UsageBar label="Team members" used={usage.members} max={usage.maxUsers} />
              {usage.maxBranches !== undefined && (
                <UsageBar label="Branches" used={usage.branches || 0} max={usage.maxBranches} />
              )}
            </>
          )}
          {trialEnds && subStatus === "trialing" && !trialExpired && (
            <p className="text-sm text-muted-foreground font-medium">
              Trial ends {trialEnds.toLocaleDateString()}.
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold mb-2">Plans</h2>
        {!canManage && (
          <p className="text-sm text-muted-foreground mb-3">
            Only owners and admins can change the plan.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = plan?.code === p.code;
            return (
              <Card key={p.id} className={isCurrent ? "border-primary shadow-sm" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold capitalize">{p.name}</p>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <p className="text-2xl font-bold">
                    ${p.priceMonthlyUsd}
                    <span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {p.maxShipmentsPerMonth <= 0
                        ? "Unlimited shipments"
                        : `${p.maxShipmentsPerMonth.toLocaleString()} shipments/mo`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {p.maxUsers <= 0 ? "Unlimited users" : `${p.maxUsers} users`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {(() => {
                        const mb = (p.features as { maxBranches?: number })?.maxBranches;
                        const resolvedBranches = mb !== undefined ? mb : (p.code === "starter" ? 1 : p.code === "growth" ? 3 : 5);
                        return `${resolvedBranches} branches limit`;
                      })()}
                    </li>
                    {(p.features as { map?: boolean })?.map && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        Remote Area Lookup
                      </li>
                    )}
                    {(p.features as { accounts?: boolean })?.accounts && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0" />
                        Accounting & Finance dropdown
                      </li>
                    )}
                  </ul>
                  <Button
                    className="w-full mt-2"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={!canManage || isCurrent || checkoutPlan !== null}
                    onClick={() => upgrade(p.code)}
                  >
                    <Zap className="h-4 w-4" />
                    {isCurrent
                      ? "Current plan"
                      : checkoutPlan === p.code
                      ? "Redirecting…"
                      : "Pay with Card"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {canManage && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Pay via Local Transfer (No Fees)
            </CardTitle>
            <CardDescription>
              Transfer funds directly to our accounts in Pakistan and upload your proof of payment for manual activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Account Details Column */}
            <div className="space-y-4 pr-0 md:pr-4 md:border-r border-border">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Our Accounts</h3>
              
              <div className="p-3 border rounded-lg bg-card hover:shadow-sm transition-all space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Landmark className="h-4 w-4 text-primary" />
                  <span>Meezan Bank</span>
                </div>
                <div className="text-xs space-y-1 text-muted-foreground font-mono">
                  <p>Title: PSS ERP Solutions</p>
                  <p>Account: 1209-082498234</p>
                  <p>IBAN: PK73MEZN1209082498234</p>
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-card hover:shadow-sm transition-all space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Smartphone className="h-4 w-4 text-emerald-500" />
                  <span>Easypaisa</span>
                </div>
                <div className="text-xs space-y-1 text-muted-foreground font-mono">
                  <p>Title: Zeeshan Ahmad</p>
                  <p>Number: 0300-1234567</p>
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-card hover:shadow-sm transition-all space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Smartphone className="h-4 w-4 text-amber-500" />
                  <span>JazzCash</span>
                </div>
                <div className="text-xs space-y-1 text-muted-foreground font-mono">
                  <p>Title: Zeeshan Ahmad</p>
                  <p>Number: 0310-7654321</p>
                </div>
              </div>

              <div className="p-3 border rounded-lg bg-card hover:shadow-sm transition-all space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <span>Cash Payment</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact platform super-admin directly at <strong>pss-admin@gmail.com</strong> for physical cash settlement.
                </p>
              </div>
            </div>

            {/* Submission Form Column */}
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Submit Payment Proof</h3>
              
              <div className="space-y-1">
                <Label htmlFor="planSelect">Target Plan</Label>
                <Select value={manualPlan} onValueChange={setManualPlan}>
                  <SelectTrigger id="planSelect">
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.code} value={p.code}>
                        <span className="capitalize">{p.name}</span> ({getPKRPriceLabel(p.code) || `$${p.priceMonthlyUsd}/mo`})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="methodSelect">Payment Method</Label>
                <Select value={manualMethod} onValueChange={setManualMethod}>
                  <SelectTrigger id="methodSelect">
                    <SelectValue placeholder="Select transfer method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="EASYPAISA">Easypaisa</SelectItem>
                    <SelectItem value="JAZZCASH">JazzCash</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="amount">Amount Paid (PKR)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="e.g. 14000" 
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="refId">Transaction ID / Ref #</Label>
                  <Input 
                    id="refId" 
                    type="text" 
                    placeholder="TID / Ref No" 
                    value={manualRefId}
                    onChange={(e) => setManualRefId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt Screenshot</Label>
                <div className="flex items-center gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="relative cursor-pointer"
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
                    <span className="text-xs text-muted-foreground">Supported format: PNG, JPG</span>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full mt-4" 
                disabled={submittingProof || uploading}
              >
                {submittingProof ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
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
