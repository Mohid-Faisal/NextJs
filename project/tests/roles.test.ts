import { describe, expect, test } from "vitest";
import { resolveRoleName } from "@/lib/auth/roles";

describe("resolveRoleName", () => {
  test("platform super admin wins", () => {
    expect(resolveRoleName("STAFF", "SUPER_ADMIN")).toBe("Super Admin");
  });

  test("owner and admin map to Admin", () => {
    expect(resolveRoleName("OWNER", null)).toBe("Admin");
    expect(resolveRoleName("ADMIN", null)).toBe("Admin");
    expect(resolveRoleName("owner", null)).toBe("Admin"); // case-insensitive
  });

  test("staff variants map to Employee", () => {
    expect(resolveRoleName("STAFF", null)).toBe("Employee");
    expect(resolveRoleName("ACCOUNTANT", null)).toBe("Employee");
    expect(resolveRoleName("EMPLOYEE", null)).toBe("Employee");
  });

  test("customer and vendor pass through", () => {
    expect(resolveRoleName("CUSTOMER", null)).toBe("Customer");
    expect(resolveRoleName("VENDOR", null)).toBe("Vendor");
  });

  test("missing role defaults to Employee", () => {
    expect(resolveRoleName(null, null)).toBe("Employee");
    expect(resolveRoleName("", null)).toBe("Employee");
  });
});
