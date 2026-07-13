"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Lock,
  Search,
  ChevronDown,
  ChevronRight,
  User,
  Building,
  Briefcase,
  Check
} from "lucide-react";

type RoleName = "Customer" | "Vendor" | "Employee" | "Admin" | "Super Admin";

interface PermissionItem {
  name: string;
  code: string;
}

interface PermissionCategory {
  name: string;
  code: string;
  permissions: PermissionItem[];
}

const permissionCategories: PermissionCategory[] = [
  {
    name: "Dashboard",
    code: "dashboard",
    permissions: [
      { name: "View activity", code: "view_activity" },
      { name: "View analytics", code: "view_analytics" },
      { name: "View KPIs", code: "view_kpis" },
      { name: "View map", code: "view_map" },
      { name: "View revenue", code: "view_revenue" },
      { name: "View dashboard", code: "view_dashboard" }
    ]
  },
  {
    name: "Shipments",
    code: "shipments",
    permissions: [
      { name: "View shipments", code: "view_shipments" },
      { name: "Create shipment", code: "create_shipment" },
      { name: "Edit shipment", code: "edit_shipment" },
      { name: "Delete shipment", code: "delete_shipment" },
      { name: "Bulk delete", code: "bulk_delete" },
      { name: "Export shipments", code: "export_shipments" },
      { name: "Update status", code: "update_status" }
    ]
  },
  {
    name: "Customers & Vendors",
    code: "contacts",
    permissions: [
      { name: "View customers", code: "view_customers" },
      { name: "Manage customers", code: "manage_customers" },
      { name: "View vendors", code: "view_vendors" },
      { name: "Manage vendors", code: "manage_vendors" }
    ]
  },
  {
    name: "Settings & Config",
    code: "settings",
    permissions: [
      { name: "View configuration", code: "view_config" },
      { name: "Manage statuses", code: "manage_statuses" },
      { name: "Manage services", code: "manage_services" },
      { name: "Manage HS codes", code: "manage_hscodes" },
      { name: "Manage billing", code: "manage_billing" }
    ]
  }
];

export default function RolesAndPermissionsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [permSearch, setPermSearch] = useState("");
  const [orgPlan, setOrgPlan] = useState<any>(null);

  // Role permissions mapping state
  const [rolePermissions, setRolePermissions] = useState<Record<RoleName, string[]>>({
    "Customer": [],
    "Vendor": [],
    "Employee": [],
    "Admin": [],
    "Super Admin": []
  });

  // Collapsed sections in permissions list
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    dashboard: false,
    shipments: false,
    contacts: false,
    settings: false
  });

  const getPlanAllowedPermissionsCount = () => {
    let count = 0;
    permissionCategories.forEach(category => {
      category.permissions.forEach(p => {
        if (orgPlan) {
          const features = orgPlan.features || {};
          if (p.code === "view_revenue" || p.code === "manage_billing") {
            if (features.accounts !== true) return;
          }
          if (p.code === "bulk_delete") {
            if (features.bulkUpload !== true) return;
          }
        }
        count++;
      });
    });
    return count || 1; // Avoid divide by zero
  };

  const fetchPermissionsAndPlan = async () => {
    setLoading(true);
    try {
      // 1. Fetch Role Permissions Settings
      const permRes = await fetch("/api/settings/custom?key=settings_role_permissions");
      if (permRes.ok) {
        const data = await permRes.json();
        if (data.value) {
          setRolePermissions(JSON.parse(data.value));
        }
      }

      // 2. Fetch Org Current Plan Features
      const orgRes = await fetch("/api/org/current");
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        if (orgData.success && orgData.organization) {
          setOrgPlan(orgData.organization.subscription?.plan || null);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load permissions data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = Cookies.get("token");
    if (token) {
      try {
        const decoded = jwtDecode<any>(token);
        const isSuper = decoded.platformRole === "SUPER_ADMIN";
        const isOwner = decoded.orgRole === "OWNER";
        if (isSuper || isOwner) {
          setIsAuthorized(true);
          fetchPermissionsAndPlan();
        } else {
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error("Token decoding error", err);
        setIsAuthorized(false);
      }
    } else {
      setIsAuthorized(false);
    }
  }, []);

  const handleTogglePermission = async (role: RoleName, code: string, checked: boolean) => {
    if (role === "Super Admin") return; // Super admin has locked access

    const updatedRoles = { ...rolePermissions };
    const list = updatedRoles[role] || [];
    if (checked) {
      if (!list.includes(code)) {
        updatedRoles[role] = [...list, code];
      }
    } else {
      updatedRoles[role] = list.filter(item => item !== code);
    }

    setRolePermissions(updatedRoles);

    // Save configuration immediately to backend
    try {
      await fetch("/api/settings/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "settings_role_permissions",
          value: JSON.stringify(updatedRoles)
        })
      });
      toast.success(`Permissions updated for role ${role}`);
    } catch {
      toast.error("Failed to sync permissions mapping to database");
    }
  };

  const getRoleCardClass = (role: RoleName) => {
    switch (role) {
      case "Customer": return { bg: "bg-pink-50/50 dark:bg-pink-950/10 border-pink-100 dark:border-pink-900/30", iconBg: "bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300", progressBg: "bg-pink-500", text: "text-pink-900 dark:text-pink-200" };
      case "Vendor": return { bg: "bg-amber-50/50 dark:bg-amber-955/10 border-amber-100 dark:border-amber-900/30", iconBg: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300", progressBg: "bg-amber-500", text: "text-amber-900 dark:text-amber-200" };
      case "Employee": return { bg: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30", iconBg: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300", progressBg: "bg-emerald-500", text: "text-emerald-900 dark:text-emerald-200" };
      case "Admin": return { bg: "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30", iconBg: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300", progressBg: "bg-blue-500", text: "text-blue-900 dark:text-blue-200" };
      case "Super Admin": return { bg: "bg-indigo-50/50 dark:bg-indigo-950/10 border-indigo-100 dark:border-indigo-900/30", iconBg: "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300", progressBg: "bg-indigo-500", text: "text-indigo-900 dark:text-indigo-200" };
    }
  };

  const getRoleIcon = (role: RoleName) => {
    switch (role) {
      case "Customer": return User;
      case "Vendor": return Building;
      case "Employee": return Briefcase;
      case "Admin": return ShieldCheck;
      case "Super Admin": return Shield;
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full text-sm text-gray-500 bg-white dark:bg-zinc-900">
        Checking permissions...
      </div>
    );
  }

  if (isAuthorized === false) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] w-full p-4 bg-white dark:bg-zinc-900">
        <Card className="max-w-md w-full shadow-lg border border-red-100 dark:border-red-950/30 bg-white dark:bg-zinc-900 rounded-xl overflow-hidden">
          <div className="h-2 bg-red-500" />
          <CardContent className="pt-6 pb-6 px-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/20 text-red-500 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Access Denied</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              You do not have permission to view the Roles & Permissions page. This section is restricted to Super Administrators and Organization Owners.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] w-full text-sm text-gray-500 bg-white dark:bg-zinc-900">
        Loading Roles & Permissions...
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full min-w-0 max-w-full overflow-x-hidden bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0 min-h-[calc(100vh-64px)]">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
            <ShieldCheck className="w-8 sm:w-10 h-8 sm:h-10 text-blue-600" />
            Roles & Permissions
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Define access levels and manage permission sets for each role
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium">
            Configure system capabilities across 4 standard user roles
          </p>
        </div>
      </div>

      {/* Role Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(["Customer", "Vendor", "Employee", "Admin"] as RoleName[]).map((r) => {
          const styles = getRoleCardClass(r);
          const Icon = getRoleIcon(r);
          const permList = rolePermissions[r] || [];
          const maxAllowedCount = getPlanAllowedPermissionsCount();
          const allowedPermList = permList.filter(code => {
            if (orgPlan) {
              const features = orgPlan.features || {};
              if (code === "view_revenue" || code === "manage_billing") {
                return features.accounts === true;
              }
              if (code === "bulk_delete") {
                return features.bulkUpload === true;
              }
            }
            return true;
          });
          const checkedCount = r === "Super Admin" ? maxAllowedCount : allowedPermList.length;
          const progressPct = Math.round((checkedCount / maxAllowedCount) * 100);

          return (
            <Card key={r} className={`shadow-sm border rounded-xl p-4 flex flex-col justify-between relative bg-white dark:bg-zinc-900 ${styles?.bg}`}>
              <div className="flex justify-between items-start">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${styles?.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {r === "Super Admin" && <Lock className="w-3.5 h-3.5 text-indigo-400 absolute top-3.5 right-3.5" />}
              </div>

              <div className="mt-4">
                <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider">{r}</h4>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">
                    {r === "Super Admin" ? "All" : `${checkedCount} / ${maxAllowedCount}`}
                  </span>
                </div>

                {/* Progress line */}
                <div className="w-full bg-gray-200/85 dark:bg-zinc-805 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div className={`h-full ${styles?.progressBg}`} style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs text-gray-400 mt-1.5 block">{progressPct}% access</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <Card className="border border-gray-150 dark:border-zinc-800 shadow-sm rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
        <div className="p-6 border-b border-gray-155 dark:border-zinc-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Roles & Permissions Matrix</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Toggle checkboxes to immediately add or revoke capabilities</p>
          </div>
          
          {/* Search inside permissions */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Search permissions..." 
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg border-gray-250 dark:border-zinc-850 bg-white dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-1 sm:border-spacing-y-2 px-6 pb-6">
            <thead>
              <tr className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase">
                <th className="px-5 py-4 w-1/3">Feature / Permission</th>
                {(["Customer", "Vendor", "Employee", "Admin"] as RoleName[]).map((r) => (
                  <th key={r} className="px-5 py-4 text-center font-bold text-gray-900 dark:text-white">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {permissionCategories.map((category) => {
                const isCollapsed = collapsedSections[category.code];
                const filteredPerms = category.permissions.filter(p => {
                  const matchesSearch = p.name.toLowerCase().includes(permSearch.toLowerCase());
                  if (!matchesSearch) return false;
                  if (orgPlan) {
                    const features = orgPlan.features || {};
                    if (p.code === "view_revenue" || p.code === "manage_billing") {
                      return features.accounts === true;
                    }
                    if (p.code === "bulk_delete") {
                      return features.bulkUpload === true;
                    }
                  }
                  return true;
                });

                if (filteredPerms.length === 0) return null;

                return (
                  <React.Fragment key={category.code}>
                    {/* Category Row */}
                    <tr 
                      className="bg-gray-50 dark:bg-zinc-800/30 text-gray-750 dark:text-zinc-300 cursor-pointer select-none font-semibold rounded-lg"
                      onClick={() => {
                        setCollapsedSections(prev => ({ ...prev, [category.code]: !prev[category.code] }));
                      }}
                    >
                      <td colSpan={5} className="px-5 py-3 rounded-lg flex items-center gap-2">
                        {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                        <span className="text-xs uppercase tracking-wider font-bold text-gray-650 dark:text-gray-400">{category.name}</span>
                        <span className="bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 text-xs px-2 py-0.5 rounded-full font-bold">
                          {filteredPerms.length}
                        </span>
                      </td>
                    </tr>

                    {/* Permission items */}
                    {!isCollapsed && filteredPerms.map((perm, idx) => (
                      <motion.tr 
                        key={perm.code}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/10 text-gray-750 dark:text-zinc-300 border-b border-gray-100/50 dark:border-zinc-800/50"
                      >
                        <td className="px-5 py-3.5 pl-9 font-medium text-gray-800 dark:text-gray-250">{perm.name}</td>
                        {(["Customer", "Vendor", "Employee", "Admin"] as RoleName[]).map((role) => {
                          const isChecked = (rolePermissions[role] || []).includes(perm.code);

                          return (
                            <td key={role} className="px-5 py-3.5 text-center">
                              <div className="flex justify-center items-center">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => handleTogglePermission(role, perm.code, !!checked)}
                                  className="h-4 w-4 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 data-[state=checked]:text-white dark:data-[state=checked]:bg-blue-500 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:text-white border-gray-300 dark:border-zinc-700"
                                />
                              </div>
                            </td>
                          );
                        })}
                      </motion.tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
