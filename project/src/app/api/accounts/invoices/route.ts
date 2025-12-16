import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = searchParams.get("limit");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const profile = searchParams.get("profile") || "";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const pageSize = limit === "all" ? undefined : parseInt(limit || "10");
    const skip = pageSize ? (page - 1) * pageSize : 0;

    // Build where clause
    const where: any = {};
    
    // Add profile filter - this must come first and not be overridden
    if (profile) {
      where.profile = profile;
    }
    
    if (search) {
      // Create search conditions that don't override the profile filter
      const searchConditions = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { destination: { contains: search, mode: "insensitive" } },
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
      
      // Only add search conditions if they don't conflict with profile filter
      if (profile) {
        // If we have a profile filter, only search within that profile
        where.AND = [
          { profile: profile },
          { OR: searchConditions }
        ];
      } else {
        // If no profile filter, use regular OR search
        where.OR = searchConditions;
      }
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
    if (sortField === "shipmentDate") {
      // For shipment date, we need nested sorting
      orderBy.shipment = {
        shipmentDate: sortOrder
      };
    } else {
      orderBy[sortField] = sortOrder;
    }

    // Debug logging
    console.log('Invoice API - Profile filter:', profile);
    console.log('Invoice API - Where clause:', JSON.stringify(where, null, 2));

    // Fetch invoices with relations
    const [invoices, total, totalAmountResult] = await Promise.all([
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
      prisma.invoice.aggregate({
        where,
        _sum: {
          totalAmount: true,
        },
      }),
    ]);

    const totalAmount = totalAmountResult._sum.totalAmount || 0;

    console.log('Invoice API - Found invoices:', invoices.length);
    console.log('Invoice API - Invoice profiles:', invoices.map(i => i.profile));

    // Calculate remaining amount for each invoice
    const invoicesWithRemainingAmount = await Promise.all(
      invoices.map(async (invoice) => {
        if (invoice.profile === "Customer") {
          // Calculate total payments for this invoice
          const totalPayments = await prisma.payment.aggregate({
            where: {
              invoice: invoice.invoiceNumber,
              transactionType: "INCOME"
            },
            _sum: {
              amount: true
            }
          });

          const totalPaid = totalPayments._sum.amount || 0;
          const remainingAmount = Math.max(0, invoice.totalAmount - totalPaid);

          return {
            ...invoice,
            remainingAmount
          };
        } else if (invoice.profile === "Vendor") {
          // Calculate total payments for vendor invoice
          const totalPayments = await prisma.payment.aggregate({
            where: {
              invoice: invoice.invoiceNumber,
              transactionType: "EXPENSE"
            },
            _sum: {
              amount: true
            }
          });

          const totalPaid = totalPayments._sum.amount || 0;
          const remainingAmount = Math.max(0, invoice.totalAmount - totalPaid);

          return {
            ...invoice,
            remainingAmount
          };
        }
        return invoice;
      })
    );

    return NextResponse.json({
      invoices: invoicesWithRemainingAmount,
      total,
      totalAmount,
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
      discount,
      lineItems,
      customerId,
      vendorId,
      shipmentId,
      disclaimer,
      totalAmount,
      currency,
      status,
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
        discount: parseFloat(discount || 0),
        lineItems,
        customerId: customerId ? parseInt(customerId) : null,
        vendorId: vendorId ? parseInt(vendorId) : null,
        shipmentId: shipmentId ? parseInt(shipmentId) : null,
        disclaimer,
        totalAmount: parseFloat(totalAmount),
        currency,
        status: status || "Unpaid",
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
