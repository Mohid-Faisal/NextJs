"use client";

import { useEffect, useState } from "react";
import { Wallet, ShieldAlert, DollarSign, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

type WalletRecord = {
  id: number;
  orgName: string;
  slug: string;
  balance: number;
  currency: string;
  status: string;
  lastUpdated: string;
};

interface DecodedToken {
  platformRole?: string | null;
}

export default function SaasWalletsPage() {
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
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

  const loadWallets = async () => {
    setLoading(true);
    try {
      // Load organizations and display virtual wallet balances
      const res = await fetch("/api/saas/organizations");
      const data = await res.json();
      if (res.ok && data.organizations) {
        // Map organizations to mock wallet records with randomized but stable balances
        const mappedWallets = data.organizations.map((org: any) => ({
          id: org.id,
          orgName: org.name,
          slug: org.slug,
          balance: org.slug === "pss-default" ? 14850.50 : (org.id * 1530) - 250,
          currency: org.currency || "USD",
          status: org.status === "active" ? "active" : org.status === "trial" ? "trial" : "inactive",
          lastUpdated: new Date(org.createdAt).toLocaleDateString(),
        }));
        setWallets(mappedWallets);
      } else {
        toast.error("Failed to load wallets");
      }
    } catch {
      toast.error("An error occurred loading wallets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadWallets();
    }
  }, [isSuperAdmin]);

  if (!mounted) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <p className="text-muted-foreground animate-pulse font-medium">Loading wallets...</p>
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

  const totalBalance = wallets.reduce((acc, w) => acc + w.balance, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold">Platform Wallets</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadWallets}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Custody Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3 text-green-500" /> +4.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wallets.filter(w => w.status === "active").length} / {wallets.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Tenant wallets currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Default Currency</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">USD / PKR</div>
            <p className="text-xs text-muted-foreground mt-1">Multi-currency exchange supported</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Virtual Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Wallet Status</TableHead>
                <TableHead>Last Transaction</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {wallets.map((wallet) => (
                <TableRow key={wallet.id}>
                  <TableCell className="font-semibold">{wallet.orgName}</TableCell>
                  <TableCell className="text-muted-foreground"><code>{wallet.slug}</code></TableCell>
                  <TableCell>
                    <Badge variant={wallet.status === "active" ? "default" : "secondary"}>
                      {wallet.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{wallet.lastUpdated}</TableCell>
                  <TableCell className="text-right font-extrabold text-slate-900 dark:text-white">
                    ${wallet.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toast.info(`Viewing transactions for ${wallet.orgName}`)}>
                      Transactions
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
