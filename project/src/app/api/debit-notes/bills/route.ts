import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get("vendorId") || "";
    const search = searchParams.get("search") || "";

    const where: any = orgWhere(session, {
      profile: "Vendor",
    });

    if (vendorId) {
      const ven = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: parseInt(vendorId, 10) }),
      });
      if (!ven) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
      where.vendorId = parseInt(vendorId, 10);
    }

    const searchTrimmed = search.trim();
    if (searchTrimmed) {
      where.OR = [
        { invoiceNumber: { contains: searchTrimmed, mode: "insensitive" } },
        { vendor: { PersonName: { contains: searchTrimmed, mode: "insensitive" } } },
        { vendor: { CompanyName: { contains: searchTrimmed, mode: "insensitive" } } },
      ];
    } else {
      return NextResponse.json({ bills: [] });
    }

    const bills = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        currency: true,
        vendor: {
          select: {
            id: true,
            PersonName: true,
            CompanyName: true,
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
      take: 100,
    });

    return NextResponse.json({ bills });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return NextResponse.json(
      { error: "Failed to fetch bills" },
      { status: 500 }
    );
  }
}
