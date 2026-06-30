export type RoleName = "Customer" | "Vendor" | "Employee" | "Admin" | "Super Admin";

export function resolveRoleName(
  orgRole: string | null | undefined,
  platformRole: string | null | undefined
): RoleName {
  if (platformRole === "SUPER_ADMIN") {
    return "Super Admin";
  }

  if (!orgRole) {
    return "Employee"; // Default fallback
  }

  const normalized = orgRole.trim().toUpperCase();

  if (normalized === "OWNER" || normalized === "ADMIN") {
    return "Admin";
  }

  if (normalized === "STAFF" || normalized === "ACCOUNTANT" || normalized === "EMPLOYEE") {
    return "Employee";
  }

  if (normalized === "CUSTOMER") {
    return "Customer";
  }

  if (normalized === "VENDOR") {
    return "Vendor";
  }

  // Fallback to title case of orgRole or original string
  return orgRole as RoleName;
}
