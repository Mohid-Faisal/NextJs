import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
