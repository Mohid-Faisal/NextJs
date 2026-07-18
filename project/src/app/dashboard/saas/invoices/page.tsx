"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Receipt, ShieldAlert, FileText, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type SaaSInvoice = {
  id: string;
  orgName: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "uncollectible" | "void";
  dueDate: string;
  createdDate: string;
  planName: string;
};

interface DecodedToken {
  platformRole?: string | null;
}

export default function SaasInvoicesPage() {
  const [invoices, setInvoices] = useState<SaaSInvoice[]>([]);
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

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/organizations");
      const data = await res.json();
      if (res.ok && data.organizations) {
        // 1. Get real invoices from database PaymentProofs
        const realInvoices = (data.paymentProofs || []).map((proof: any) => ({
          id: `INV-${new Date(proof.createdAt).getFullYear()}-${1000 + proof.id}`,
          orgName: proof.organization.name,
          amount: proof.amount,
          currency: "USD",
          status: proof.status === "approved" ? "paid" : proof.status === "pending" ? "open" : "void",
          dueDate: new Date(new Date(proof.createdAt).setDate(new Date(proof.createdAt).getDate() + 15)).toLocaleDateString(),
          createdDate: new Date(proof.createdAt).toLocaleDateString(),
          planName: proof.plan.name,
        }));

        // 2. Generate trial/free invoices for orgs with no payment proofs
        const trialInvoices: SaaSInvoice[] = [];
        data.organizations.forEach((org: any) => {
          const hasProofs = (org.paymentProofs || []).length > 0;
          if (!hasProofs && org.status === "trial") {
            trialInvoices.push({
              id: `INV-TRIAL-${1000 + org.id}`,
              orgName: org.name,
              amount: 0,
              currency: "USD",
              status: "paid",
              dueDate: new Date(new Date(org.createdAt).setDate(new Date(org.createdAt).getDate() + 14)).toLocaleDateString(),
              createdDate: new Date(org.createdAt).toLocaleDateString(),
              planName: "Free Trial (14 Days)",
            });
          }
        });

        // Combine both
        setInvoices([...realInvoices, ...trialInvoices]);
      } else {
        toast.error("Failed to load invoices");
      }
    } catch {
      toast.error("An error occurred loading invoices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadInvoices();
    }
  }, [isSuperAdmin]);

  if (!mounted) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground animate-pulse font-medium">Loading invoices...</p>
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

  const invoiceVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "open":
        return "secondary";
      case "void":
        return "destructive";
      default:
        return "outline";
    }
  };

  const totalCollected = invoices
    .filter(i => i.status === "paid")
    .reduce((acc, i) => acc + i.amount, 0);

  const pendingAmount = invoices
    .filter(i => i.status === "open")
    .reduce((acc, i) => acc + i.amount, 0);

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
            <h1 className="text-2xl font-bold">Platform SaaS Invoices</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Platform service invoices generated for tenant organizations.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadInvoices}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected Revenue</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Successfully settled payments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balances</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting client payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices Issued</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Invoices compiled in billing cycle</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices Registry</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Service Plan</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono font-medium">{inv.id}</TableCell>
                  <TableCell className="font-semibold">{inv.orgName}</TableCell>
                  <TableCell className="capitalize">{inv.planName}</TableCell>
                  <TableCell>{inv.createdDate}</TableCell>
                  <TableCell>{inv.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={invoiceVariant(inv.status)} className="capitalize">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">${inv.amount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toast.success(`Receipt printed for ${inv.id}`)}>
                      Receipt
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
