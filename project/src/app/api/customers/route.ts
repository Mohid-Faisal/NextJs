import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { parseListPaging } from "@/lib/money";

export async function GET(req: Request) {
  const auth = await requirePermission(req, "view_customers");
  if (auth.error) return auth.error;
  const session = auth.session;

  const { searchParams } = new URL(req.url);
  const { take: limit, skip } = parseListPaging(searchParams, 10);

  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const sortField = searchParams.get("sortField") || "id";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const onlyWithBalance = searchParams.get("onlyWithBalance") === "true";

  const where: any = { ...orgWhere(session) };

  if (status) where.ActiveStatus = status;
  if (onlyWithBalance) where.currentBalance = { not: 0 };

  // Fuzzy search across specific columns only
  if (search) {
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(search.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    
    where.OR = [
      { CompanyName: { contains: search} },
      { PersonName: { contains: search} },
      { Phone: { contains: search} },
      { City: { contains: search} },
      { Country: { contains: search} },
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
    skip,
    take: limit,
  };

  const [customers, total, grandTotal, withBalanceTotal, activeTotal, inactiveTotal] = await Promise.all([
    prisma.customers.findMany(findManyOptions),
    prisma.customers.count({ where }),
    prisma.customers.count({ where: orgWhere(session) }),
    prisma.customers.count({ where: { ...orgWhere(session), currentBalance: { not: 0 } } }),
    prisma.customers.count({ where: { ...orgWhere(session), ActiveStatus: "Active" } }),
    prisma.customers.count({ where: { ...orgWhere(session), ActiveStatus: "Inactive" } }),
  ]);

  // Get shipment information for each customer. Shipments relate to
  // customers via senderName === CompanyName, so fetch all shipments for the
  // page's customers in one query and bucket them per company name instead
  // of running a findMany per customer.
  const companyNames = customers
    .map((customer) => customer.CompanyName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  const allShipments = companyNames.length > 0
    ? await prisma.shipment.findMany({
        where: orgWhere(session, {
          senderName: { in: companyNames },
        }),
        select: {
          id: true,
          trackingId: true,
          senderName: true,
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
      })
    : [];

  const shipmentsBySender = new Map<string, typeof allShipments>();
  for (const shipment of allShipments) {
    if (!shipment.senderName) continue;
    const bucket = shipmentsBySender.get(shipment.senderName);
    if (bucket) bucket.push(shipment);
    else shipmentsBySender.set(shipment.senderName, [shipment]);
  }

  const customersWithShipments = customers.map((customer) => {
    const shipments =
      (customer.CompanyName && shipmentsBySender.get(customer.CompanyName)) || [];

    // Get unique recipients
    const uniqueRecipients = [...new Set(shipments.map(s => s.recipientName))];

    // Calculate total shipment value
    const totalShipmentValue = shipments.reduce((sum, shipment) => sum + Number(shipment.totalCost || 0), 0);

    return {
      ...customer,
      shipmentCount: shipments.length,
      uniqueRecipients: uniqueRecipients,
      totalShipmentValue: totalShipmentValue,
      recentShipments: shipments
        .slice(0, 5)
        .map(({ senderName: _senderName, ...rest }) => rest) // Get last 5 shipments (same shape as before)
    };
  });

  return NextResponse.json({
    customers: customersWithShipments,
    total,
    grandTotal,
    withBalanceTotal,
    activeTotal,
    inactiveTotal,
  });
}
