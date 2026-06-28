"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Building2, Save } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  subscription: {
    status: string;
    trialEndsAt: string | null;
    plan: { code: string; name: string; maxUsers: number; maxShipmentsPerMonth: number } | null;
  } | null;
};

const CURRENCIES = ["PKR", "USD", "EUR", "GBP", "AED", "INR", "SAR"];
const MANAGE_ROLES = ["OWNER", "ADMIN"];

export default function OrganizationSettingsPage() {
  const [org, setOrg] = useState<OrgData | null>(null);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("PKR");
  const [logoUrl, setLogoUrl] = useState("");

  const canManage = MANAGE_ROLES.includes(role);

  const load = useCallback(async () => {
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load organization");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/org/current", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, currency, logoUrl: logoUrl || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Organization updated");
      setOrg((prev) => (prev ? { ...prev, ...data.organization } : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>;
  }
  if (!org) {
    return <div className="p-6 text-muted-foreground">Organization not found.</div>;
  }

  const dirty = name !== org.name || currency !== (org.currency || "PKR") || (logoUrl || "") !== (org.logoUrl || "");

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Building2 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Organization Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{org.name}</p>
              <p className="text-sm text-muted-foreground">{org.slug}</p>
            </div>
            <Badge variant={org.status === "suspended" ? "destructive" : org.status === "trial" ? "secondary" : "default"} className="capitalize">
              {org.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canManage && (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed p-3">
              You have view-only access. Only owners and admins can edit organization settings.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={!canManage}>
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                disabled={!canManage}
              />
            </div>
          </div>

          {canManage && (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving || !dirty}>
                <Save className="h-4 w-4" />
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="font-semibold">Subscription</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="capitalize">{org.subscription?.plan?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize">{org.subscription?.status ?? "—"}</span>
          </div>
          {org.subscription?.trialEndsAt && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trial ends</span>
              <span>{new Date(org.subscription.trialEndsAt).toLocaleDateString()}</span>
            </div>
          )}
          {org.subscription?.plan && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Limits</span>
              <span>
                {org.subscription.plan.maxUsers} users · {org.subscription.plan.maxShipmentsPerMonth.toLocaleString()} shipments/mo
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
