import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const customers = await prisma.customers.findMany({
      where: {
        CompanyName: {
          contains: query,
          mode: "insensitive",
        },
      },
      take: 10,
      select: {
        id: true,
        CompanyName: true,
        Address: true,
      }
    });

    // Transform the data to match frontend expectations
    const transformedCustomers = customers.map(customer => ({
      id: customer.id,
      Company: customer.CompanyName, // Map CompanyName to Company
      Address: customer.Address,
    }));

    return NextResponse.json(transformedCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json([]);
  }
}
