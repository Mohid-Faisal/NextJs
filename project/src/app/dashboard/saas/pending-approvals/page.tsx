"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { UserCheck, RefreshCw, ShieldAlert, Check, X, Building2 } from "lucide-react";

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

type PendingOrg = {
  id: number;
  name: string;
  slug: string;
  status: string;
  role: string;
};

type PendingUser = {
  id: number;
  name: string;
  email: string;
  status: string;
  createdAt: string;
  organizations: PendingOrg[];
};

export default function PendingApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/saas/pending-approvals");
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setUsers([]);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pending approvals");
      setForbidden(false);
      setUsers(data.users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pending approvals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (user: PendingUser) => {
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/users/approve/${user.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(`${user.name || user.email} approved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (user: PendingUser) => {
    if (
      !window.confirm(
        `Reject ${user.name || user.email}? This deletes their account` +
          (user.organizations.length ? " and any brand-new trial workspace they just created." : ".")
      )
    )
      return;
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/saas/pending-approvals/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("Account rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed");
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Pending Approvals</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/saas/organizations">
            <Button variant="ghost" size="sm">
              <Building2 className="h-4 w-4" />
              Organizations
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${users.length} account(s) awaiting approval`}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No accounts awaiting approval.
                  </TableCell>
                </TableRow>
              )}
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    {u.organizations.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {u.organizations.map((o) => (
                          <span key={o.id} className="text-sm">
                            {o.name}{" "}
                            <Badge variant="outline" className="ml-1">
                              {o.role}
                            </Badge>
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {u.status === "PENDING_VERIFICATION"
                        ? "Unverified"
                        : u.status === "PENDING_APPROVAL"
                        ? "Awaiting approval"
                        : u.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => approve(u)}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busyId === u.id}
                        onClick={() => reject(u)}
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
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
