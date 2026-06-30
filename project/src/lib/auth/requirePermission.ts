import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { prisma } from "@/lib/prisma";
import { resolveRoleName, type RoleName } from "@/lib/auth/roles";
import type { SessionPayload } from "@/lib/auth/session";

type PermissionResult =
  | { session: SessionPayload; error: null }
  | { session: null; error: NextResponse };

const defaultPermissions: Record<RoleName, string[]> = {
  "Customer": ["view_activity", "view_map", "view_dashboard", "view_shipments"],
  "Vendor": ["view_activity", "view_dashboard", "view_shipments", "update_status"],
  "Employee": ["view_activity", "view_analytics", "view_dashboard", "view_shipments", "create_shipment", "edit_shipment", "update_status", "view_customers", "view_vendors"],
  "Admin": ["view_activity", "view_analytics", "view_kpis", "view_map", "view_revenue", "view_dashboard", "view_shipments", "create_shipment", "edit_shipment", "delete_shipment", "bulk_delete", "export_shipments", "update_status", "view_customers", "manage_customers", "view_vendors", "manage_vendors", "view_config", "manage_statuses", "manage_services", "manage_hscodes", "manage_billing"],
  "Super Admin": ["view_activity", "view_analytics", "view_kpis", "view_map", "view_revenue", "view_dashboard", "view_shipments", "create_shipment", "edit_shipment", "delete_shipment", "bulk_delete", "export_shipments", "update_status", "view_customers", "manage_customers", "view_vendors", "manage_vendors", "view_config", "manage_statuses", "manage_services", "manage_hscodes", "manage_billing"]
};

export async function requirePermission(
  req: Request,
  permissionCode: string
): Promise<PermissionResult> {
  const auth = await requireApiSession(req);
  if (auth.error) {
    return auth;
  }

  const { session } = auth;

  // Super Admin bypasses all checks
  if (session.platformRole === "SUPER_ADMIN") {
    return { session, error: null };
  }

  // Org Owners bypass all checks (Admin access)
  if (session.orgRole === "OWNER") {
    return { session, error: null };
  }

  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "settings_role_permissions" }
    });

    let permissionsMapping = defaultPermissions;
    if (setting) {
      try {
        permissionsMapping = JSON.parse(setting.value);
      } catch (e) {
        console.error("Error parsing settings_role_permissions:", e);
      }
    }

    const roleName = resolveRoleName(session.orgRole, session.platformRole);
    const userPermissions = permissionsMapping[roleName] || [];

    if (userPermissions.includes(permissionCode)) {
      return { session, error: null };
    }

    return {
      session: null,
      error: NextResponse.json(
        { success: false, error: `Forbidden: Insufficient permissions (${permissionCode})` },
        { status: 403 }
      )
    };
  } catch (error) {
    console.error("Database error checking permissions:", error);
    return {
      session: null,
      error: NextResponse.json(
        { success: false, error: "Internal server error during permissions check" },
        { status: 500 }
      )
    };
  }
}
