import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth/requireSuperAdmin";

/**
 * GET /api/admin/reconcile?organizationId=<id>
 * Super-admin only.
 *
 * Safety net for non-transactional balance math (#data-integrity):
 * recomputes expected customer/vendor balances from their transaction
 * ledgers and diffs against the denormalized `currentBalance` columns.
 *
 * Sign convention used by this codebase:
 *   Customers: CREDIT increases balance, DEBIT decreases.
 *   Vendors:   DEBIT increases balance (we owe), CREDIT decreases.
 */

export async function GET(req: NextRequest) {
  const auth = await requireSuperAdmin(req);
  if (auth.error) return auth.error;

  const orgParam = req.nextUrl.searchParams.get("organizationId");
  const organizationId = orgParam ? parseInt(orgParam, 10) : NaN;
  if (!Number.isFinite(organizationId)) {
    return NextResponse.json(
      { success: false, error: "organizationId query parameter required" },
      { status: 400 }
    );
  }

  try {
    // ---- Customers -----------------------------------------------------
    const customers = await prisma.customers.findMany({
      where: { organizationId },
      select: { id: true, CompanyName: true, currentBalance: true },
    });

    const customerAgg = await prisma.customerTransaction.groupBy({
      by: ["customerId", "type"],
      where: { organizationId },
      _sum: { amount: true },
    });

    const customerDelta = new Map<number, number>();
    for (const row of customerAgg) {
      const signed = row.type === "CREDIT" ? row._sum.amount ?? 0 : -(row._sum.amount ?? 0);
      customerDelta.set(row.customerId, (customerDelta.get(row.customerId) ?? 0) + signed);
    }

    const customerDrifts = customers
      .map((c) => ({
        id: c.id,
        name: c.CompanyName,
        storedBalance: c.currentBalance,
        computedBalance: round2(customerDelta.get(c.id) ?? 0),
        drift: round2(c.currentBalance - (customerDelta.get(c.id) ?? 0)),
      }))
      .filter((d) => Math.abs(d.drift) > 0.01);

    // ---- Vendors -------------------------------------------------------
    const vendors = await prisma.vendors.findMany({
      where: { organizationId },
      select: { id: true, CompanyName: true, currentBalance: true },
    });

    const vendorAgg = await prisma.vendorTransaction.groupBy({
      by: ["vendorId", "type"],
      where: { organizationId },
      _sum: { amount: true },
    });

    const vendorDelta = new Map<number, number>();
    for (const row of vendorAgg) {
      const signed = row.type === "DEBIT" ? row._sum.amount ?? 0 : -(row._sum.amount ?? 0);
      vendorDelta.set(row.vendorId, (vendorDelta.get(row.vendorId) ?? 0) + signed);
    }

    const vendorDrifts = vendors
      .map((v) => ({
        id: v.id,
        name: v.CompanyName,
        storedBalance: v.currentBalance,
        computedBalance: round2(vendorDelta.get(v.id) ?? 0),
        drift: round2(v.currentBalance - (vendorDelta.get(v.id) ?? 0)),
      }))
      .filter((d) => Math.abs(d.drift) > 0.01);

    return NextResponse.json({
      success: true,
      organizationId,
      checkedAt: new Date().toISOString(),
      summary: {
        customersChecked: customers.length,
        customersWithDrift: customerDrifts.length,
        vendorsChecked: vendors.length,
        vendorsWithDrift: vendorDrifts.length,
      },
      customerDrifts,
      vendorDrifts,
    });
  } catch (error) {
    console.error("Reconciliation failed:", error);
    return NextResponse.json(
      { success: false, error: "Reconciliation failed" },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
