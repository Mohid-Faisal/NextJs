import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  if (search) {
    where.OR = [
      { trackingId: { contains: search, mode: "insensitive" } },
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
  }

  // Sorting
  const orderBy: any = sortField
    ? { [sortField]: sortOrder }
    : { shipmentDate: "desc" as const };

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

  return NextResponse.json({ shipments, total });
}
