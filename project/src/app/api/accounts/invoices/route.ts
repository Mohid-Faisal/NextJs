import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = searchParams.get("limit");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const pageSize = limit === "all" ? undefined : parseInt(limit || "10");
    const skip = pageSize ? (page - 1) * pageSize : 0;

    // Build where clause
    const where: any = {};
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
        { profile: { contains: search, mode: "insensitive" } },
        { customer: { 
          OR: [
            { CompanyName: { contains: search, mode: "insensitive" } },
            { PersonName: { contains: search, mode: "insensitive" } }
          ]
        } },
        { vendor: { 
          OR: [
            { CompanyName: { contains: search, mode: "insensitive" } },
            { PersonName: { contains: search, mode: "insensitive" } }
          ]
        } },
      ];
    }
    if (status && status !== "All") {
      where.status = status;
    }

    // Add date range filtering
    if (fromDate || toDate) {
      where.invoiceDate = {};
      if (fromDate) {
        where.invoiceDate.gte = new Date(fromDate);
      }
      if (toDate) {
        where.invoiceDate.lte = new Date(toDate);
      }
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortField] = sortOrder;

    // Fetch invoices with relations
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          vendor: true,
          shipment: true,
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      total,
      page,
      totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      invoiceNumber,
      invoiceDate,
      receiptNumber,
      trackingNumber,
      destination,
      dayWeek,
      weight,
      profile,
      fscCharges,
      lineItems,
      customerId,
      vendorId,
      shipmentId,
      disclaimer,
      totalAmount,
      currency,
    } = body;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        receiptNumber,
        trackingNumber,
        destination,
        dayWeek,
        weight: parseFloat(weight),
        profile,
        fscCharges: parseFloat(fscCharges || 0),
        lineItems,
        customerId: customerId ? parseInt(customerId) : null,
        vendorId: vendorId ? parseInt(vendorId) : null,
        shipmentId: shipmentId ? parseInt(shipmentId) : null,
        disclaimer,
        totalAmount: parseFloat(totalAmount),
        currency,
      },
      include: {
        customer: true,
        vendor: true,
        shipment: true,
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
