import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/requirePermission";
import { reconcileInvoiceJournalEntries } from "@/lib/accounts/reconcileInvoiceJournalEntries";

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    const { dateFrom, dateTo } = body || {};

    const result = await reconcileInvoiceJournalEntries(
      session,
      dateFrom,
      dateTo
    );

    return NextResponse.json({
      success: true,
      message: `Reconciliation complete. Created: ${result.created}, Updated: ${result.updated}, Removed: ${result.removed}`,
      ...result,
    });
  } catch (error) {
    console.error("Ledger reconciliation failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Ledger reconciliation failed",
      },
      { status: 500 }
    );
  }
}
