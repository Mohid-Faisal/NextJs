import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const customers = await prisma.customers.findMany({
    where: {
      Company: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: 10,
    select: {
        id: true,
        Company: true,
        Address: true,
      }
  });

  return NextResponse.json(customers);
}
