import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const status = searchParams.get("status") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const invoiceStatus = searchParams.get("invoiceStatus") || undefined;
  const search = searchParams.get("search")?.trim() || "";

  const where: any = {};

  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (invoiceStatus) where.invoiceStatus = invoiceStatus;

  // Fuzzy search
  if (search) {
    where.OR = [
      { trackingId: { contains: search, mode: "insensitive" } },
      { senderName: { contains: search, mode: "insensitive" } },
      { recipientName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [shipments, total] = await Promise.all([
    prisma.shipment.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: "desc" },
    }),
    prisma.shipment.count({ where }),
  ]);

  return NextResponse.json({ shipments, total });
}
