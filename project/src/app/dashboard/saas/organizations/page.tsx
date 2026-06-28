"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Building2, RefreshCw, ShieldAlert, UserCheck, DollarSign } from "lucide-react";

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Organizations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/saas/pending-approvals">
            <Button variant="ghost" size="sm">
              <UserCheck className="h-4 w-4" />
              Approvals
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadOrgs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${orgs.length} organization(s) on the platform`}
          </p>
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
