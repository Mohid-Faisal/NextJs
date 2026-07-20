"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Landmark, RefreshCw, ShieldAlert, Check, X, 
  Building2, ExternalLink, MessageSquare, Calendar, ArrowLeft
} from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
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

type Plan = {
  id: number;
  name: string;
  code: string;
  priceMonthlyUsd: number;
};

type Organization = {
  id: number;
  name: string;
  slug: string;
  status: string;
};

type PaymentProof = {
  id: number;
  organizationId: number;
  planId: number;
  amount: number;
  currency: string;
  amountPkr: number;
  method: string;
  referenceId: string;
  receiptUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  organization: Organization;
  plan: Plan;
};

export default function SaaSManualPaymentsPage() {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/payment-proofs");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setProofs([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load payment proofs");
      setForbidden(false);
      setProofs(data.proofs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payment proofs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (proof: PaymentProof) => {
    const input = window.prompt(
      `Approve payment for "${proof.organization.name}"?\nEnter number of months to activate subscription:`,
      "1"
    );
    if (input === null) return;
    const months = parseInt(input, 10);
    if (isNaN(months) || months <= 0) {
      toast.error("Please enter a valid number of months.");
      return;
    }

    setBusyId(proof.id);
    try {
      const res = await fetch(`/api/saas/payment-proofs/${proof.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "approved",
          months,
          notes: `Approved by admin for ${months} month(s).`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve payment");
      
      toast.success(`Payment proof approved! Organization active for ${months} month(s).`);
      setProofs((prev) =>
        prev.map((p) => (p.id === proof.id ? { ...p, status: "approved", notes: data.proof.notes } : p))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (proof: PaymentProof) => {
    const notes = window.prompt(
      `Reject payment for "${proof.organization.name}"?\nEnter rejection reason/notes:`,
      "Invalid payment reference or missing receipt image."
    );
    if (notes === null) return;

    setBusyId(proof.id);
    try {
      const res = await fetch(`/api/saas/payment-proofs/${proof.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "rejected",
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reject payment");
      
      toast.success("Payment proof rejected.");
      setProofs((prev) =>
        prev.map((p) => (p.id === proof.id ? { ...p, status: "rejected", notes: data.proof.notes } : p))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setBusyId(null);
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

  const formatMethod = (method: string) => {
    if (method === "BANK_TRANSFER") return "Bank Transfer";
    if (method === "EASYPAISA") return "Easypaisa";
    if (method === "JAZZCASH") return "JazzCash";
    if (method === "CASH") return "Cash";
    return method;
  };

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
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review and approve manual subscription payments from tenants.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${proofs.length} payment proof(s) submitted`}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Requested Plan</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Amount (PKR)</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference ID</TableHead>
                <TableHead>Submitted Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proofs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    {loading ? "Loading proofs..." : "No payment proofs submitted yet."}
                  </TableCell>
                </TableRow>
              ) : (
                proofs.map((proof) => {
                  const isPending = proof.status === "pending";
                  const displayPkr = proof.amountPkr || (proof.currency === "PKR" ? proof.amount : 0);
                  return (
                    <TableRow key={proof.id}>
                      <TableCell>
                        <div className="font-semibold">{proof.organization.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">@{proof.organization.slug}</div>
                      </TableCell>
                      <TableCell className="capitalize font-medium">{proof.plan.name}</TableCell>
                      <TableCell className="font-mono">
                        {proof.currency || "PKR"} {proof.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="font-mono">
                        PKR {displayPkr > 0 ? displayPkr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                      </TableCell>
                      <TableCell>{formatMethod(proof.method)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{proof.referenceId}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(proof.createdAt).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {proof.receiptUrl ? (
                          <a 
                            href={proof.receiptUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-xs font-semibold"
                          >
                            <span>View</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No image</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            proof.status === "approved"
                              ? "default"
                              : proof.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {proof.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isPending ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleApprove(proof)}
                                disabled={busyId !== null}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-semibold"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(proof)}
                                disabled={busyId !== null}
                                className="flex items-center gap-1 font-semibold"
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          ) : (
                            proof.notes && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 max-w-[180px] truncate" title={proof.notes}>
                                <MessageSquare className="h-3 w-3 shrink-0" />
                                <span className="truncate">{proof.notes}</span>
                              </div>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
