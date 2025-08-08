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
    | "awbNumber"
    | "createdAt"
    | "senderName"
    | "recipientName"
    | "destination"
    | "deliveryStatus"
    | "totalCost"
    | "invoiceStatus"
    | null;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  const where: any = {};

  if (status) where.deliveryStatus = status;
  if (invoiceStatus) where.invoiceStatus = invoiceStatus;
  
  // Date range filtering
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) {
      where.createdAt.gte = new Date(fromDate);
    }
    if (toDate) {
      where.createdAt.lte = new Date(toDate);
    }
  }

  // Fuzzy search
  if (search) {
    where.OR = [
      { awbNumber: { contains: search, mode: "insensitive" } },
      { senderName: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
    ];
  }

  // Sorting
  const orderBy: any = sortField
    ? { [sortField]: sortOrder }
    : { createdAt: "desc" as const };

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      skip,
      take: limit,
      where,
      orderBy,
    }),
    prisma.shipment.count({ where }),
  ]);

  return NextResponse.json({ shipments, total });
}
