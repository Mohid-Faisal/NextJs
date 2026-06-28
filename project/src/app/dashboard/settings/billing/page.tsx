"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Wallet, Check, Zap, AlertTriangle } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Usage = {
  shipmentsThisMonth: number;
  maxShipmentsPerMonth: number; // -1 = unlimited
  members: number;
  maxUsers: number; // -1 = unlimited
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

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const subStatus = plan?.subscriptionStatus ?? null;
  const trialEnds = plan?.trialEndsAt ? new Date(plan.trialEndsAt) : null;
  const trialExpired = subStatus === "trialing" && trialEnds && trialEnds.getTime() < Date.now();
  const inactive = subStatus === "past_due" || subStatus === "canceled";

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center gap-2">
        <Wallet className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
      </div>

      {(trialExpired || inactive) && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm">
              {inactive
                ? "Your subscription is inactive. Choose a plan below to restore full access."
                : "Your free trial has ended. Choose a plan below to keep creating shipments."}
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
            </>
          )}
          {trialEnds && subStatus === "trialing" && !trialExpired && (
            <p className="text-sm text-muted-foreground">
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
              <Card key={p.id} className={isCurrent ? "border-primary" : ""}>
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
                      <Check className="h-4 w-4 text-primary" />
                      {p.maxShipmentsPerMonth <= 0
                        ? "Unlimited shipments"
                        : `${p.maxShipmentsPerMonth.toLocaleString()} shipments/mo`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {p.maxUsers <= 0 ? "Unlimited users" : `${p.maxUsers} users`}
                    </li>
                    {(p.features as { accounts?: boolean })?.accounts && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        Accounting module
                      </li>
                    )}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={!canManage || isCurrent || checkoutPlan !== null}
                    onClick={() => upgrade(p.code)}
                  >
                    <Zap className="h-4 w-4" />
                    {isCurrent
                      ? "Current plan"
                      : checkoutPlan === p.code
                      ? "Redirecting…"
                      : "Choose plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
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
