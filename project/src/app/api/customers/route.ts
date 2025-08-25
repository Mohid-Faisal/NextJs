import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";

export async function GET(req: Request) {
    // console.log("working");
    
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit") || "10";
  const isAll = limitParam === "all";
  const limit = isAll ? undefined : parseInt(limitParam);
  const skip = isAll ? 0 : (page - 1) * (limit || 10);

  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const sortField = searchParams.get("sortField") || "id";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const where: any = {};

  if (status) where.ActiveStatus = status;

  // Fuzzy search across specific columns only
  if (search) {
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(search.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    
    where.OR = [
      { CompanyName: { contains: search, mode: "insensitive" } },
      { PersonName: { contains: search, mode: "insensitive" } },
      { Phone: { contains: search, mode: "insensitive" } },
      { City: { contains: search, mode: "insensitive" } },
      { Country: { contains: search, mode: "insensitive" } },
    ];
    
    // If we found matching country codes, also search for those
    if (countryCodes.length > 0) {
      where.OR.push({ Country: { in: countryCodes } });
    }
  }

  // Validate sort field
  const validSortFields = ["id", "CompanyName", "PersonName", "Phone", "City", "Country", "ActiveStatus", "createdAt", "currentBalance"];
  const validSortOrder = ["asc", "desc"];
  
  const finalSortField = validSortFields.includes(sortField) ? sortField : "id";
  const finalSortOrder = validSortOrder.includes(sortOrder) ? sortOrder : "desc";
  
  const findManyOptions: any = {
    where,
    orderBy: { [finalSortField]: finalSortOrder },
  };

  // Only add skip and take if not fetching all
  if (!isAll) {
    findManyOptions.skip = skip;
    findManyOptions.take = limit;
  }

  const [customers, total] = await Promise.all([
    prisma.customers.findMany(findManyOptions),
    prisma.customers.count({ where }),
  ]);

  // Get shipment information for each customer
  const customersWithShipments = await Promise.all(
    customers.map(async (customer) => {
      // Get shipments where this customer is the sender
      const shipments = await prisma.shipment.findMany({
        where: {
          senderName: customer.CompanyName
        },
        select: {
          id: true,
          trackingId: true,
          recipientName: true,
          destination: true,
          totalCost: true,
          shipmentDate: true,
          deliveryStatus: true,
          invoiceStatus: true
        },
        orderBy: {
          shipmentDate: 'desc'
        }
      });

      // Get unique recipients
      const uniqueRecipients = [...new Set(shipments.map(s => s.recipientName))];
      
      // Calculate total shipment value
      const totalShipmentValue = shipments.reduce((sum, shipment) => sum + shipment.totalCost, 0);

      return {
        ...customer,
        shipmentCount: shipments.length,
        uniqueRecipients: uniqueRecipients,
        totalShipmentValue: totalShipmentValue,
        recentShipments: shipments.slice(0, 5) // Get last 5 shipments
      };
    })
  );

//   console.log("customers",customers);

  return NextResponse.json({ customers: customersWithShipments, total });
}
