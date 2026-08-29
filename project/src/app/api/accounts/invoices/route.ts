import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Country } from "country-state-city";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { parseListPaging, money } from "@/lib/money";
import { calculateInvoicePaymentStatus } from "@/lib/accounts/invoicePayments";
import {
  createJournalEntryForTransaction,
  addCustomerTransaction,
  addVendorTransaction,
} from "@/lib/server/ledger";

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "view_revenue");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const { page, take: pageSize, skip } = parseListPaging(searchParams, 10);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const profile = searchParams.get("profile") || "";
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const shipmentId = searchParams.get("shipmentId");
    
    // Build where clause
    const where: any = { ...orgWhere(session) };
    
    if (shipmentId) {
      where.shipmentId = parseInt(shipmentId);
    }
    
    // Add profile filter - this must come first and not be overridden
    if (profile) {
      where.profile = profile;
    }

    const agency = searchParams.get("agency");
    if (agency && agency !== "All") {
      where.shipment = {
        agency: agency
      };
    }
    
    if (search) {
      // Try to parse as number for price search
      const searchAsNumber = parseFloat(search);
      const isNumericSearch = !isNaN(searchAsNumber);
      
      // Get all country codes that match the search term (by name or code)
      const matchingCountryCodes: string[] = [];
      if (search.trim()) {
        const allCountries = Country.getAllCountries();
        const searchLower = search.toLowerCase().trim();
        allCountries.forEach(country => {
          if (
            country.name.toLowerCase().includes(searchLower) ||
            country.isoCode.toLowerCase().includes(searchLower) ||
            country.name.toLowerCase() === searchLower
          ) {
            matchingCountryCodes.push(country.isoCode);
          }
        });
      }
      
      // Create search conditions that don't override the profile filter
      const searchConditions: any[] = [
        { invoiceNumber: { contains: search} },
        { trackingNumber: { contains: search} },
        { destination: { contains: search} },
        { customer: { 
          OR: [
            { CompanyName: { contains: search} },
            { PersonName: { contains: search} }
          ]
        } },
        { vendor: { 
          OR: [
            { CompanyName: { contains: search} },
            { PersonName: { contains: search} }
          ]
        } },
      ];
      
      // Add country code search if we found matching countries
      if (matchingCountryCodes.length > 0) {
        searchConditions.push({
          destination: { in: matchingCountryCodes }
        });
      }
      
      // Add price search if search term is numeric
      if (isNumericSearch) {
        // Search for amounts that match (with small tolerance for rounding)
        searchConditions.push({
          totalAmount: {
            gte: searchAsNumber * 0.99, // Allow small rounding differences
            lte: searchAsNumber * 1.01
          }
        });
      }
      
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

    // Same filters as `where`, but without the status filter — used to compute the
    // per-status counts that drive the tab badges (so they show full counts even
    // when a tab is currently active).
    const whereForCounts: any = { ...where };
    delete whereForCounts.status;

    // Fetch invoices with relations
    const [invoices, total, totalAmountResult, statusCountsRows] = await Promise.all([
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
      prisma.invoice.groupBy({
        by: ["status"],
        where: whereForCounts,
        _count: { _all: true },
      }),
    ]);

    const totalAmount = money(totalAmountResult._sum.totalAmount);

    const statusCounts: Record<string, number> = {};
    let allStatusCount = 0;
    for (const row of statusCountsRows) {
      const key = row.status || "Unknown";
      const count = row._count._all;
      statusCounts[key] = count;
      allStatusCount += count;
    }

    const invoicesWithRemainingAmount = await Promise.all(
      invoices.map(async (invoice) => {
        const paymentStatus = await calculateInvoicePaymentStatus(
          prisma,
          invoice.invoiceNumber,
          money(invoice.totalAmount),
          session.organizationId,
          invoice.id
        );
        return {
          ...invoice,
          remainingAmount: paymentStatus.remainingAmount,
        };
      })
    );

    return NextResponse.json({
      invoices: invoicesWithRemainingAmount,
      total,
      totalAmount,
      statusCounts,
      allStatusCount,
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
    const auth = await requirePermission(req, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

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

    const parsedCustomerId = customerId ? parseInt(customerId) : null;
    const parsedVendorId = vendorId ? parseInt(vendorId) : null;
    const parsedShipmentId = shipmentId ? parseInt(shipmentId) : null;

    if (parsedCustomerId) {
      const customer = await prisma.customers.findFirst({
        where: orgWhere(session, { id: parsedCustomerId }),
      });
      if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 400 });
      }
    }
    if (parsedVendorId) {
      const vendor = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: parsedVendorId }),
      });
      if (!vendor) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 400 });
      }
    }
    if (parsedShipmentId) {
      const shipment = await prisma.shipment.findFirst({
        where: orgWhere(session, { id: parsedShipmentId }),
      });
      if (!shipment) {
        return NextResponse.json({ error: "Shipment not found" }, { status: 400 });
      }
    }

    const invAmount = parseFloat(totalAmount) || 0;
    const invDate = new Date(invoiceDate);

    const invoice = await prisma.$transaction(
      async (tx) => {
        const created = await tx.invoice.create({
          data: orgData(session, {
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
            customerId: parsedCustomerId,
            vendorId: parsedVendorId,
            shipmentId: parsedShipmentId,
            disclaimer,
            totalAmount: parseFloat(totalAmount),
            currency,
            status: status || "Unpaid",
          }),
          include: {
            customer: true,
            vendor: true,
            shipment: true,
          },
        });

        if (invAmount > 0) {
          if (parsedCustomerId || profile === "Customer") {
            if (!parsedShipmentId && parsedCustomerId) {
              await addCustomerTransaction(
                tx,
                parsedCustomerId,
                "DEBIT",
                invAmount,
                `Invoice ${invoiceNumber}${destination ? ` | ${destination}` : ""}`,
                invoiceNumber,
                invoiceNumber,
                invDate,
                session.organizationId
              );
            }
            const existingRevenueJE = await tx.journalEntry.findFirst({
              where: orgWhere(session, { reference: invoiceNumber }),
            });
            if (!existingRevenueJE) {
              await createJournalEntryForTransaction(
                tx,
                "CUSTOMER_DEBIT",
                invAmount,
                `Customer invoice ${invoiceNumber}${trackingNumber ? ` for shipment ${trackingNumber}` : ""}`,
                invoiceNumber,
                invoiceNumber,
                invDate,
                session.organizationId
              );
            }
          } else if (parsedVendorId || profile === "Vendor") {
            if (!parsedShipmentId && parsedVendorId) {
              await addVendorTransaction(
                tx,
                parsedVendorId,
                "DEBIT",
                invAmount,
                `Vendor bill ${invoiceNumber}${destination ? ` | ${destination}` : ""}`,
                invoiceNumber,
                invoiceNumber,
                invDate,
                session.organizationId
              );
            }
            const existingExpenseJE = await tx.journalEntry.findFirst({
              where: orgWhere(session, { reference: invoiceNumber }),
            });
            if (!existingExpenseJE) {
              await createJournalEntryForTransaction(
                tx,
                "VENDOR_DEBIT",
                invAmount,
                `Vendor bill ${invoiceNumber}${trackingNumber ? ` for shipment ${trackingNumber}` : ""}`,
                invoiceNumber,
                invoiceNumber,
                invDate,
                session.organizationId
              );
            }
          }
        }

        return created;
      },
      { timeout: 30000 }
    );

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
