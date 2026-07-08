import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: Request) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const { searchParams } = new URL(req.url);

  const limitParam = searchParams.get("limit") ?? "10";
  const fetchAll =
    limitParam.toLowerCase() === "all" || limitParam.toLowerCase() === "none";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const limitNum = fetchAll
    ? 0
    : Math.max(1, parseInt(limitParam, 10) || 10);
  const skip = fetchAll ? 0 : (page - 1) * limitNum;

  const status = searchParams.get("status") || undefined; // status maps to deliveryStatus
  const invoiceStatus = searchParams.get("invoiceStatus") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const type = searchParams.get("type") || undefined;
  const sortField = searchParams.get("sortField") as
    | "trackingId"
    | "invoiceNumber"
    | "createdAt"
    | "shipmentDate"
    | "senderName"
    | "recipientName"
    | "destination"
    | "totalCost"
    | "invoiceStatus"
    | null;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  // Debug logging for search
  console.log('=== SHIPMENTS API SEARCH DEBUG ===');
  console.log('Search term:', search);
  console.log('Search term length:', search.length);
  console.log('Search term trimmed:', search.trim());
  console.log('Type filter:', type);
  console.log('All search params:', Object.fromEntries(searchParams.entries()));

  const where: any = { ...orgWhere(session) };

  if (status) where.deliveryStatus = status;
  if (invoiceStatus) where.invoiceStatus = invoiceStatus;
  
  // Date range filtering - use shipmentDate instead of createdAt
  if (fromDate || toDate) {
    where.shipmentDate = {};
    if (fromDate) {
      where.shipmentDate.gte = new Date(fromDate);
    }
    if (toDate) {
      where.shipmentDate.lte = new Date(toDate);
    }
  }

  const andConditions: any[] = [];

  // Fuzzy search across all relevant columns
  if (search && search.length > 0) {
    console.log('Building search query for term:', `"${search}"`);
    
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(search.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    console.log('Matching countries found:', matchingCountries.map(c => ({ name: c.name, code: c.isoCode })));
    console.log('Country codes for search:', countryCodes);
    
    const searchOr: any[] = [
      { trackingId: { contains: search} },
      { referenceNumber: { contains: search} },
      { invoiceNumber: { contains: search} },
      { agency: { contains: search} },
      { office: { contains: search} },
      { senderName: { contains: search} },
      { senderAddress: { contains: search} },
      { recipientName: { contains: search} },
      { recipientAddress: { contains: search} },
      { destination: { contains: search} },
      { deliveryTime: { contains: search} },
      { invoiceStatus: { contains: search} },
      { deliveryStatus: { contains: search} },
      { shippingMode: { contains: search} },
      { packaging: { contains: search} },
      { vendor: { contains: search} },
      { serviceMode: { contains: search} },
      { packageDescription: { contains: search} },
    ];
    
    // If we found matching country codes, also search for those in destination
    if (countryCodes.length > 0) {
      searchOr.push({ destination: { in: countryCodes } });
    }
    
    andConditions.push({ OR: searchOr });
  }

  // Type filtering: domestic vs international
  if (type === "domestic") {
    andConditions.push({
      OR: [
        { destination: { equals: "PK"} },
        { destination: { equals: "Pakistan"} }
      ]
    });
  } else if (type === "international") {
    andConditions.push({
      AND: [
        { destination: { not: "PK" } },
        { destination: { not: "Pakistan" } },
        { destination: { not: "pk" } },
        { destination: { not: "pakistan" } },
        { destination: { not: "PAKISTAN" } }
      ]
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  // Sorting
  const orderBy: any = sortField
    ? { [sortField]: sortOrder }
    : { shipmentDate: "desc" as const };

  console.log('Final WHERE clause:', JSON.stringify(where, null, 2));
  console.log('Order by:', orderBy);
  console.log('=== END SHIPMENTS API SEARCH DEBUG ===');

  try {
    // Build a base where without the status filter so we can count per-status
    const { deliveryStatus: _ds, ...baseWhereNoStatus } = where;

    const [shipments, total, grandTotal, bookedCount, inTransitCount, deliveredCount, cancelledCount, sumResult] = await Promise.all([
      prisma.shipment.findMany({
        ...(fetchAll ? {} : { skip, take: limitNum }),
        where,
        orderBy,
        include: {
          invoices: {
            where: {
              profile: "Customer"
            },
            select: {
              id: true,
              status: true
            }
          }
        }
      }),
      prisma.shipment.count({ where }),
      prisma.shipment.count({ where: baseWhereNoStatus }),
      prisma.shipment.count({ where: { ...baseWhereNoStatus, deliveryStatus: "Booked" } }),
      prisma.shipment.count({ where: { ...baseWhereNoStatus, deliveryStatus: "In Transit" } }),
      prisma.shipment.count({ where: { ...baseWhereNoStatus, deliveryStatus: "Delivered" } }),
      prisma.shipment.count({ where: { ...baseWhereNoStatus, deliveryStatus: "Cancelled" } }),
      prisma.shipment.aggregate({
        where,
        _sum: {
          totalCost: true
        }
      })
    ]);

    const totalValue = sumResult._sum.totalCost || 0;

    return NextResponse.json({ shipments, total, grandTotal, bookedCount, inTransitCount, deliveredCount, cancelledCount, totalValue });
  } catch (error) {
    console.error('Error in shipments API:', error);
    console.error('Search term was:', search);
    console.error('WHERE clause was:', JSON.stringify(where, null, 2));
    return NextResponse.json(
      { error: "Failed to fetch shipments", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
