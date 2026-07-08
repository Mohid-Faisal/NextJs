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
    const customerId = searchParams.get("customerId") || "";
    const search = searchParams.get("search") || "";

    const where: any = orgWhere(session, {
      profile: "Customer",
    });

    if (customerId) {
      const cust = await prisma.customers.findFirst({
        where: orgWhere(session, { id: parseInt(customerId, 10) }),
      });
      if (!cust) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      where.customerId = parseInt(customerId, 10);
    }

    const searchTrimmed = search.trim();
    if (searchTrimmed) {
      where.OR = [
        { invoiceNumber: { contains: searchTrimmed} },
        { customer: { PersonName: { contains: searchTrimmed} } },
        { customer: { CompanyName: { contains: searchTrimmed} } },
      ];
    } else {
      return NextResponse.json({ invoices: [] });
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        totalAmount: true,
        currency: true,
        customer: {
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

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
