import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/requirePermission";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, "view_revenue");
    if (auth.error) return auth.error;

    const { id } = await params;
    
    // Redirect to the receipt page instead of generating PDF
    return NextResponse.redirect(new URL(`/dashboard/receipt/${id}`, request.url));
    
  } catch (error) {
    console.error("Error redirecting to receipt:", error);
    return NextResponse.json(
      { error: "Failed to redirect to receipt" },
      { status: 500 }
    );
  }
}
