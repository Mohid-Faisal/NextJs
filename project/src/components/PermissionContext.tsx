"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { resolveRoleName, type RoleName } from "@/lib/auth/roles";

interface PermissionContextType {
  role: RoleName | null;
  orgRole: string | null;
  platformRole: string | null;
  permissions: string[];
  hasPermission: (code: string) => boolean;
  planFeatures: Record<string, any> | null;
  hasFeature: (key: string) => boolean;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextType>({
  role: null,
  orgRole: null,
  platformRole: null,
  permissions: [],
  hasPermission: () => false,
  planFeatures: null,
  hasFeature: () => false,
  loading: true,
});

export const usePermissions = () => useContext(PermissionContext);

export const routePermissions: Record<string, string> = {
  "/dashboard/add-shipment": "create_shipment",
  "/dashboard/shipments": "view_shipments",
  "/dashboard/rate-calculator": "view_shipments",
  "/dashboard/customers": "view_customers",
  "/dashboard/recipients": "view_customers",
  "/dashboard/vendors": "view_vendors",
  "/dashboard/income/invoices": "manage_billing",
  "/dashboard/income/revenue": "view_revenue",
  "/dashboard/income/credit-notes": "manage_billing",
  "/dashboard/expense/bills": "manage_billing",
  "/dashboard/expense/payments": "manage_billing",
  "/dashboard/expense/debit-notes": "manage_billing",
  "/dashboard/accounts/payments": "view_revenue",
  "/dashboard/chart-of-accounts": "manage_billing",
  "/dashboard/accounts/account-books": "manage_billing",
  "/dashboard/journal-entries": "manage_billing",
  "/dashboard/accounts/balance-sheet": "manage_billing",
  "/dashboard/accounts/income-statement": "manage_billing",
  "/dashboard/reports": "view_analytics",
  "/dashboard/settings/branding": "view_config",
  "/dashboard/settings/manage-zones": "manage_statuses",
  "/dashboard/settings/manage-rate-list": "manage_billing",
  "/dashboard/settings/remote-area-lookup": "view_map",
  "/dashboard/settings/hscodes": "manage_hscodes",
  "/dashboard/configuration": "view_config",
};

export const getRequiredPermission = (path: string): string | null => {
  if (path === "/dashboard") return "view_dashboard";
  
  for (const [route, permission] of Object.entries(routePermissions)) {
    if (path === route || path.startsWith(route + "/")) {
      return permission;
    }
  }
  return null;
};

export const PermissionProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<RoleName | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [platformRole, setPlatformRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [planFeatures, setPlanFeatures] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissionsAndPlan = async () => {
      try {
        const token = Cookies.get("token");
        if (!token) {
          setLoading(false);
          return;
        }

        const decoded = jwtDecode<any>(token);
        const uOrgRole = decoded.orgRole || null;
        const uPlatformRole = decoded.platformRole || null;
        
        setOrgRole(uOrgRole);
        setPlatformRole(uPlatformRole);

        const resolvedRole = resolveRoleName(uOrgRole, uPlatformRole);
        setRole(resolvedRole);

        // Fetch permissions mapping
        const res = await fetch("/api/settings/custom?key=settings_role_permissions");
        if (res.ok) {
          const data = await res.json();
          if (data.value) {
            const mapping = JSON.parse(data.value);
            const list = mapping[resolvedRole] || [];
            setPermissions(list);
          }
        }

        // Fetch current org to get plan features
        const orgRes = await fetch("/api/org/current");
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (orgData.organization) {
            const orgId = orgData.organization.id;
            const sub = orgData.organization.subscription;
            const isTrialActive = sub?.status === "trialing" && sub?.trialEndsAt && new Date(sub.trialEndsAt) > new Date();

            if (orgId === 1 || isTrialActive) {
              setPlanFeatures({
                accounts: true,
                bulkUpload: true,
                map: true,
                analytics: true,
                activityLogs: true,
                customersPage: true,
                vendorsPage: true,
                recipientsPage: true,
              });
            } else {
              const features = sub?.plan?.features || {};
              setPlanFeatures(features);
            }
          }
        }
      } catch (err) {
        console.error("Error loading permissions context:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissionsAndPlan();
  }, []);

  const hasPermission = (code: string): boolean => {
    if (loading) return false;
    if (platformRole === "SUPER_ADMIN") return true;
    if (orgRole === "OWNER") return true;
    return permissions.includes(code);
  };

  const hasFeature = (key: string): boolean => {
    if (loading) return false;
    if (platformRole === "SUPER_ADMIN") return true;
    if (!planFeatures) return false;
    return planFeatures[key] === true;
  };

  return (
    <PermissionContext.Provider
      value={{
        role,
        orgRole,
        platformRole,
        permissions,
        hasPermission,
        planFeatures,
        hasFeature,
        loading,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};
