import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const status = searchParams.get("status") || undefined; // status maps to deliveryStatus
  const invoiceStatus = searchParams.get("invoiceStatus") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
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
  console.log('All search params:', Object.fromEntries(searchParams.entries()));

  const where: any = {};

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
    
    where.OR = [
      { trackingId: { contains: search, mode: "insensitive" } },
      { referenceNumber: { contains: search, mode: "insensitive" } },
      { invoiceNumber: { contains: search, mode: "insensitive" } },
      { agency: { contains: search, mode: "insensitive" } },
      { office: { contains: search, mode: "insensitive" } },
      { senderName: { contains: search, mode: "insensitive" } },
      { senderAddress: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
      { recipientAddress: { contains: search, mode: "insensitive" } },
      { destination: { contains: search, mode: "insensitive" } },
      { deliveryTime: { contains: search, mode: "insensitive" } },
      { invoiceStatus: { contains: search, mode: "insensitive" } },
      { deliveryStatus: { contains: search, mode: "insensitive" } },
      { shippingMode: { contains: search, mode: "insensitive" } },
      { packaging: { contains: search, mode: "insensitive" } },
      { vendor: { contains: search, mode: "insensitive" } },
      { serviceMode: { contains: search, mode: "insensitive" } },
      { packageDescription: { contains: search, mode: "insensitive" } },
    ];
    
    // If we found matching country codes, also search for those in destination
    if (countryCodes.length > 0) {
      where.OR.push({ destination: { in: countryCodes } });
    }
    
    console.log('Search WHERE clause:', JSON.stringify(where.OR, null, 2));
  } else {
    console.log('No search term provided or search term is empty');
  }

  // Sorting
  const orderBy: any = sortField
    ? { [sortField]: sortOrder }
    : { shipmentDate: "desc" as const };

  console.log('Final WHERE clause:', JSON.stringify(where, null, 2));
  console.log('Order by:', orderBy);
  console.log('=== END SHIPMENTS API SEARCH DEBUG ===');

  try {
    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        skip,
        take: limit,
        where,
        orderBy,
        include: {
          invoices: {
            where: {
              profile: "Customer"
            },
            select: {
              status: true
            }
          }
        }
      }),
      prisma.shipment.count({ where }),
    ]);

    console.log(`Found ${shipments.length} shipments out of ${total} total`);
    if (search && shipments.length > 0) {
      console.log('Sample search results:');
      shipments.slice(0, 3).forEach((shipment, index) => {
        console.log(`Result ${index + 1}:`, {
          id: shipment.id,
          trackingId: shipment.trackingId,
          invoiceNumber: shipment.invoiceNumber,
          senderName: shipment.senderName,
          recipientName: shipment.recipientName,
          destination: shipment.destination,
          packaging: shipment.packaging
        });
      });
    }

    return NextResponse.json({ shipments, total });
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
