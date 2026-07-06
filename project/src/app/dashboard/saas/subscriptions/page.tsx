"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ShieldAlert, BadgePercent, Clock, Activity, RefreshCw, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type SubscriptionRecord = {
  id: number;
  orgName: string;
  planName: string;
  planPrice: number;
  status: string;
  startDate: string;
  nextRenewal: string;
};

interface DecodedToken {
  platformRole?: string | null;
}

export default function SaasSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/organizations");
      const data = await res.json();
      if (res.ok && data.organizations) {
        const mappedSubs = data.organizations.map((org: any) => {
          const planPrice = org.plan ? (org.plan.code === "pro" ? 99 : org.plan.code === "business" ? 49 : 19) : 0;
          return {
            id: org.id,
            orgName: org.name,
            planName: org.plan?.name || "Free Trial",
            planPrice,
            status: org.subscriptionStatus || (org.status === "suspended" ? "suspended" : "trialing"),
            startDate: new Date(org.createdAt).toLocaleDateString(),
            nextRenewal: new Date(new Date(org.createdAt).setMonth(new Date(org.createdAt).getMonth() + 1)).toLocaleDateString(),
          };
        });
        setSubscriptions(mappedSubs);
      } else {
        toast.error("Failed to load subscriptions");
      }
    } catch {
      toast.error("An error occurred loading subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadSubscriptions();
    }
  }, [isSuperAdmin]);

  if (!mounted) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground animate-pulse font-medium">Loading subscriptions...</p>
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

  const subVariant = (status: string) => {
    switch (status) {
      case "active":
      case "trialing":
        return "default";
      case "suspended":
      case "canceled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const monthlyRecurrentRevenue = subscriptions
    .filter(s => s.status === "active")
    .reduce((acc, s) => acc + s.planPrice, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/saas/organizations">
            <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-slate-900 border shadow-xs">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Tenant Subscriptions</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Overview of all active and past tenant subscriptions.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadSubscriptions}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Revenue (MRR)</CardTitle>
            <BadgePercent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${monthlyRecurrentRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">From active paid subscriptions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Accounts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.filter(s => s.status === "trialing").length}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Currently in 14-day trials
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All tenants on database</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Subscription Register</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Current Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Started On</TableHead>
                <TableHead>Next Renewal</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-semibold">{sub.orgName}</TableCell>
                  <TableCell className="capitalize">{sub.planName}</TableCell>
                  <TableCell>
                    <Badge variant={subVariant(sub.status)} className="capitalize">
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">${sub.planPrice}</TableCell>
                  <TableCell>{sub.startDate}</TableCell>
                  <TableCell>{sub.nextRenewal}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toast.info(`Managing subscription for ${sub.orgName}`)}>
                      Manage
                    </Button>
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
