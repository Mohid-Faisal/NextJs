"use client";

import { useEffect, useState } from "react";
import { Layers, ShieldAlert, Plus, Sparkles, Check, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

interface DecodedToken {
  platformRole?: string | null;
}

export default function SaasPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">Platform Subscription Plans</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadPlans}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => toast.info("Plan creation is configured via seed files.")}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Plan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300">
            {plan.code === "pro" && (
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-bl-lg flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Best Seller
              </div>
            )}
            <CardHeader>
              <CardTitle className="capitalize text-xl">{plan.name}</CardTitle>
              <CardDescription>Plan identifier: <code className="text-xs">{plan.code}</code></CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">${plan.priceMonthlyUsd}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>
              <hr />
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Up to <strong>{plan.maxUsers}</strong> users/staff</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Up to <strong>{plan.maxShipmentsPerMonth.toLocaleString()}</strong> shipments/mo</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Multi-tenant isolation & data security</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600 shrink-0" />
                  <span>Basic support & accounting modules</span>
                </li>
              </ul>
              <Button className="w-full mt-4" variant="outline" onClick={() => toast.success("Configuration loaded")}>
                Configure Plan Features
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Detailed Plan Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Price (Monthly)</TableHead>
                <TableHead className="text-right">Max Users</TableHead>
                <TableHead className="text-right">Max Shipments</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-semibold capitalize">{plan.name}</TableCell>
                  <TableCell><code>{plan.code}</code></TableCell>
                  <TableCell className="font-medium">${plan.priceMonthlyUsd}</TableCell>
                  <TableCell className="text-right font-medium">{plan.maxUsers}</TableCell>
                  <TableCell className="text-right font-medium">{plan.maxShipmentsPerMonth.toLocaleString()}</TableCell>
                  <TableCell><Badge>Active</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
