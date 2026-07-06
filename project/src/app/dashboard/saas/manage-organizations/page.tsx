"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { 
  Building2, RefreshCw, ShieldAlert, DollarSign, 
  Trash2, Search, ArrowLeft, ShieldCheck, Lock,
  Unlock, Check, HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TablePagination, TablePageSize } from "@/components/TablePagination";

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

export default function SaasManageOrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [filteredOrgs, setFilteredOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  // Search and Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(10);

  // 2FA Deletion Modal State
  const [deleteOrg, setDeleteOrg] = useState<Organization | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteStep, setDeleteStep] = useState<"password" | "verification">("password");
  const [delete2FACode, setDelete2FACode] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Filter organizations by search term
  useEffect(() => {
    let result = orgs;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.slug.toLowerCase().includes(q) ||
          (o.plan?.name || "").toLowerCase().includes(q)
      );
    }
    setFilteredOrgs(result);
    setPage(1); // Reset to page 1 on search
  }, [searchTerm, orgs]);

  // Paginated data
  const total = filteredOrgs.length;
  const isAll = pageSize === "all";
  const size = isAll ? total : (pageSize as number);
  const totalPages = size === 0 ? 1 : Math.ceil(total / size);
  const paginatedOrgs = isAll
    ? filteredOrgs
    : filteredOrgs.slice((page - 1) * size, page * size);

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

  // --- Deletion Flow with 2FA ---
  const startDeleteOrg = (org: Organization) => {
    setDeleteOrg(org);
    setDeletePassword("");
    setDelete2FACode("");
    setDeleteStep("password");
  };

  const sendDeletion2FACode = async () => {
    if (!deletePassword) {
      toast.error("Password is required to request deletion code");
      return;
    }
    setIsSendingCode(true);
    try {
      const res = await fetch(`/api/saas/organizations/${deleteOrg?.id}/send-2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteStep("verification");
        toast.success("A 6-digit verification code has been sent to your email!");
      } else {
        toast.error(data.error || "Failed to send verification code");
      }
    } catch (err) {
      toast.error("An error occurred while requesting verification code");
    } finally {
      setIsSendingCode(false);
    }
  };

  const executeDeleteOrg = async () => {
    if (!delete2FACode || delete2FACode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code");
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/saas/organizations/${deleteOrg?.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword, verificationCode: delete2FACode }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Organization and all its data deleted successfully!");
        setDeleteOrg(null);
        loadOrgs();
      } else {
        toast.error(data.error || "Failed to delete organization");
      }
    } catch (err) {
      toast.error("An error occurred during deletion");
    } finally {
      setIsDeleting(false);
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

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-zinc-950/20 min-h-screen w-full min-w-0 max-w-full overflow-x-hidden">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/saas/organizations">
            <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-slate-900 border shadow-xs">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Organizations</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review, mark paid, suspend, or delete tenant orgs and all their data.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadOrgs} disabled={loading} className="self-end sm:self-auto bg-white dark:bg-slate-900">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Main Organizations Card */}
      <Card className="shadow-sm border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-100 dark:border-zinc-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold">All Orgs</CardTitle>
            <CardDescription className="text-xs">
              {loading ? "Loading orgs..." : `${total} org(s) registered`}
            </CardDescription>
          </div>
          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
            <Input
              placeholder="Search by name or slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-9 text-xs rounded-lg border-slate-200 dark:border-zinc-800"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="overflow-x-auto border border-slate-100 dark:border-zinc-850 rounded-xl">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/70 dark:bg-zinc-800/40 text-[11px] font-bold text-gray-500">
                  <TableHead className="py-3.5 font-bold">Name</TableHead>
                  <TableHead className="py-3.5 font-bold">Slug</TableHead>
                  <TableHead className="py-3.5 font-bold">Status</TableHead>
                  <TableHead className="py-3.5 font-bold">Plan</TableHead>
                  <TableHead className="py-3.5 text-right font-bold">Members</TableHead>
                  <TableHead className="py-3.5 text-right font-bold">Shipments</TableHead>
                  <TableHead className="py-3.5 font-bold">Created</TableHead>
                  <TableHead className="py-3.5 text-right font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
                      Loading orgs...
                    </TableCell>
                  </TableRow>
                ) : paginatedOrgs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      No orgs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOrgs.map((org) => (
                    <TableRow key={org.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                      <TableCell className="font-semibold text-slate-900 dark:text-white">{org.name}</TableCell>
                      <TableCell className="text-muted-foreground font-medium">{org.slug}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(org.status)} className="capitalize text-[10px] px-2 py-0.5 rounded-full font-bold">
                          {org.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {org.plan ? (
                          <div className="flex flex-col">
                            <span className="capitalize font-semibold">{org.plan.name}</span>
                            {org.subscriptionStatus && (
                              <span className="text-[10px] text-muted-foreground capitalize mt-0.5">
                                {org.subscriptionStatus.replace("_", " ")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{org.memberCount}</TableCell>
                      <TableCell className="text-right font-semibold">{org.shipmentCount}</TableCell>
                      <TableCell className="text-muted-foreground font-medium">{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={pendingId === org.id}
                            onClick={() => markPaid(org)}
                            className="h-7 text-[10px] px-2 border-slate-200"
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            Mark paid
                          </Button>
                          {org.status === "suspended" ? (
                            <Button
                              size="xs"
                              variant="outline"
                              disabled={pendingId === org.id}
                              onClick={() => updateStatus(org, "active")}
                              className="h-7 text-[10px] px-2 border-slate-200"
                            >
                              Activate
                            </Button>
                          ) : (
                            <Button
                              size="xs"
                              variant="secondary"
                              disabled={pendingId === org.id}
                              onClick={() => updateStatus(org, "suspended")}
                              className="h-7 text-[10px] px-2 border-slate-250 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/20"
                            >
                              Suspend
                            </Button>
                          )}
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => startDeleteOrg(org)}
                            className="h-7 text-[10px] px-2 flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <TablePagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              entityName="orgs"
            />
          )}
        </CardContent>
      </Card>

      {/* 2FA Deletion Dialog */}
      <Dialog open={deleteOrg !== null} onOpenChange={(open) => !open && setDeleteOrg(null)}>
        <DialogContent className="max-w-md w-full rounded-xl p-6 border-slate-200 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Delete Org
            </DialogTitle>
            <CardDescription className="text-xs">
              This action is highly critical. You are about to permanently delete <span className="font-bold text-slate-900 dark:text-white">{deleteOrg?.name}</span>, including all its shipments, customers, invoices, transactions, settings, and its users. This cannot be undone.
            </CardDescription>
          </DialogHeader>

          {deleteStep === "password" ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="deletePassword">Confirm Your Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter admin password to continue"
                    className="pl-9 bg-white dark:bg-slate-950 text-sm"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setDeleteOrg(null)}>Cancel</Button>
                <Button 
                  disabled={!deletePassword || isSendingCode} 
                  onClick={sendDeletion2FACode} 
                  className="bg-indigo-600 text-white"
                >
                  {isSendingCode ? (
                    <><RefreshCw className="w-4 h-4 animate-spin mr-1.5" />Sending...</>
                  ) : (
                    <>Request 2FA Code</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>We sent a 6-digit verification code to your email. Enter the code below to complete deletion.</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delete2FACode">Verification Code</Label>
                <Input
                  id="delete2FACode"
                  value={delete2FACode}
                  onChange={(e) => setDelete2FACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit verification code"
                  className="bg-white dark:bg-slate-950 text-center tracking-[4px] font-bold text-lg h-11"
                />
              </div>
              <DialogFooter className="pt-2">
                <Button variant="ghost" onClick={() => setDeleteStep("password")}>Back</Button>
                <Button 
                  disabled={delete2FACode.length !== 6 || isDeleting} 
                  onClick={executeDeleteOrg} 
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  {isDeleting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin mr-1.5" />Deleting...</>
                  ) : (
                    <>Permanently Delete Org</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
