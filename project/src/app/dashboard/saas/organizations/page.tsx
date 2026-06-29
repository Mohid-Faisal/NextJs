"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Building2, RefreshCw, ShieldAlert, UserCheck, DollarSign, 
  Layers, Wallet, FileText, Receipt, ArrowUpRight, ArrowDownRight, 
  CheckCircle2, AlertTriangle, Lock, HelpCircle, ArrowRight,
  TrendingUp, Clock
} from "lucide-react";
import { motion } from "framer-motion";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Organization = {
  id: number;
  name: string;
  slug: string;
  status: string;
  currency: string;
  createdAt: string;
  memberCount: number;
  shipmentCount: number;
  plan: { code: string; name: string } | null;
  subscriptionStatus: string | null;
};

// Mock chart data matching the user's screenshot exactly
const chartData = [
  { name: "Jul 2025", revenue: 0 },
  { name: "Aug 2025", revenue: 0 },
  { name: "Sep 2025", revenue: 0 },
  { name: "Oct 2025", revenue: 0 },
  { name: "Nov 2025", revenue: 0 },
  { name: "Dec 2025", revenue: 0 },
  { name: "Jan 2026", revenue: 0 },
  { name: "Feb 2026", revenue: 0 },
  { name: "Mar 2026", revenue: 5 },
  { name: "Apr 2026", revenue: 78 },
  { name: "May 2026", revenue: 15 },
  { name: "Jun 2026", revenue: 5 },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "trial":
      return "secondary";
    case "suspended":
      return "destructive";
    default:
      return "outline";
  }
}

export default function SaasOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/organizations");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setOrgs([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load organizations");
      setForbidden(false);
      setOrgs(data.organizations ?? []);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const updateStatus = async (org: Organization, status: string) => {
    const verb = status === "suspended" ? "Suspend" : "Activate";
    if (!window.confirm(`${verb} "${org.name}"?`)) return;

    setPendingId(org.id);
    try {
      const res = await fetch(`/api/saas/organizations/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setOrgs((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, status: data.organization.status } : o))
      );
      toast.success(`${org.name} ${status === "suspended" ? "suspended" : "activated"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPendingId(null);
    }
  };

  const markPaid = async (org: Organization) => {
    const input = window.prompt(
      `Mark "${org.name}" as paid for how many months?`,
      "1"
    );
    if (input === null) return;
    const months = parseInt(input, 10);
    if (isNaN(months) || months <= 0) {
      toast.error("Enter a valid number of months");
      return;
    }

    setPendingId(org.id);
    try {
      const res = await fetch(`/api/saas/organizations/${org.id}/billing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Mark paid failed");
      const sub = data.organization?.subscription;
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === org.id
            ? { ...o, status: data.organization.status, subscriptionStatus: sub?.status ?? o.subscriptionStatus }
            : o
        )
      );
      toast.success(`${org.name} marked paid for ${months} month(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mark paid failed");
    } finally {
      setPendingId(null);
    }
  };

  if (forbidden) {
    return (
      <div className="p-6">
        <Card className="max-w-lg mx-auto mt-10">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground">
              This area is restricted to platform super administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate dynamic stats
  const activeSubs = orgs.filter(o => o.status === "active" || o.status === "trial").length;
  const noSubs = orgs.filter(o => !o.plan).length;
  const suspendedCount = orgs.filter(o => o.status === "suspended").length;

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Billing Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SaaS platform revenue, subscriptions and wallet overview.
          </p>
        </div>
        
        {/* Quick Nav Row */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/saas/plans">
            <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Layers className="h-4 w-4 mr-2 text-indigo-500" />
              Plans
            </Button>
          </Link>
          <Link href="/dashboard/saas/subscriptions">
            <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <FileText className="h-4 w-4 mr-2 text-blue-500" />
              Subscriptions
            </Button>
          </Link>
          <Link href="/dashboard/saas/wallets">
            <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Wallet className="h-4 w-4 mr-2 text-emerald-500" />
              Wallets
            </Button>
          </Link>
          <Link href="/dashboard/saas/invoices">
            <Button variant="outline" size="sm" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <Receipt className="h-4 w-4 mr-2 text-orange-500" />
              Invoices
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadOrgs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Row of 6 Mini Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Revenue This Month */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">$0.00</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">Revenue This Month</p>
            </div>
          </CardContent>
        </Card>

        {/* Revenue This Year */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">$91.00</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">Revenue This Year</p>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center text-teal-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">{activeSubs}</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">Active Subscriptions</p>
            </div>
          </CardContent>
        </Card>

        {/* In Grace Period */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">0</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">In Grace Period</p>
            </div>
          </CardContent>
        </Card>

        {/* Read Only */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600">
              <Lock className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">{suspendedCount}</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">Read Only</p>
            </div>
          </CardContent>
        </Card>

        {/* No Subscription */}
        <Card className="bg-white dark:bg-slate-950/50 hover:shadow-md transition-shadow">
          <CardContent className="p-3 flex flex-col justify-between h-full">
            <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-500">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="mt-2">
              <span className="text-lg sm:text-xl font-bold tracking-tight">{noSubs}</span>
              <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-0.5">No Subscription</p>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Main Chart Area */}
      <Card className="bg-white dark:bg-slate-950/40 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Last 12 Months</h2>
              <p className="text-xs text-muted-foreground">Revenue This Year</p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-extrabold tracking-tight">$91.00</span>
              <p className="text-xs text-muted-foreground">Revenue This Month: $0.00</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="purpleG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.15} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => `$${val}`}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip 
                  formatter={(value) => [`$${value}`, "Revenue"]}
                  contentStyle={{ 
                    background: "rgba(15, 23, 42, 0.9)", 
                    border: "none", 
                    borderRadius: "6px",
                    color: "#fff"
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#purpleG)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Side-by-Side Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Expiring Soon (7 days) */}
        <Card className="bg-white dark:bg-slate-950/40">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base font-bold">Expiring Soon (7 days)</CardTitle>
            </div>
            <Link href="/dashboard/saas/subscriptions" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground py-4 text-center">
              No subscriptions or trials are expiring in the next 7 days.
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="bg-white dark:bg-slate-950/40">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-base font-bold">Transaction History</CardTitle>
            </div>
            <Link href="/dashboard/saas/invoices" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgs.filter(o => o.plan).slice(0, 3).map((org) => {
              const amount = org.plan?.code === "pro" ? 99 : org.plan?.code === "business" ? 49 : 19;
              return (
                <div key={org.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-sm">{org.name}</p>
                    <p className="text-xs text-muted-foreground">Plan: {org.plan?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-600">+${amount}.00</span>
                    <p className="text-[10px] text-muted-foreground">{new Date(org.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              );
            })}
            {orgs.filter(o => o.plan).length === 0 && (
              <div className="text-sm text-muted-foreground py-4 text-center">
                No recent payment transactions recorded.
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* The original Organizations table */}
      <Card className="bg-white dark:bg-slate-950/40">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Manage Organizations</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${orgs.length} organization(s) registered on the platform`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Shipments</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No organizations found.
                  </TableCell>
                </TableRow>
              )}
              {orgs.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(org.status)} className="capitalize">
                      {org.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {org.plan ? (
                      <div className="flex flex-col">
                        <span className="capitalize">{org.plan.name}</span>
                        {org.subscriptionStatus && (
                          <span className="text-xs text-muted-foreground capitalize">
                            {org.subscriptionStatus.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{org.memberCount}</TableCell>
                  <TableCell className="text-right">{org.shipmentCount}</TableCell>
                  <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingId === org.id}
                        onClick={() => markPaid(org)}
                      >
                        <DollarSign className="h-4 w-4" />
                        Mark paid
                      </Button>
                      {org.status === "suspended" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === org.id}
                          onClick={() => updateStatus(org, "active")}
                        >
                          Activate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pendingId === org.id}
                          onClick={() => updateStatus(org, "suspended")}
                        >
                          Suspend
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
