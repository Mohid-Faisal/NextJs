import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Country } from "country-state-city";

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
        PersonName: true,
        Email: true,
        Phone: true,
        Address: true,
        Country: true,
        State: true,
        City: true,
        Zip: true,
      }
    });

    // Transform the data to match frontend expectations
    const transformedCustomers = customers.map(customer => ({
      id: customer.id,
      Company: customer.CompanyName, // Map CompanyName to Company
      PersonName: customer.PersonName,
      Email: customer.Email,
      Phone: customer.Phone,
      Address: customer.Address,
      Country: customer.Country,
      State: customer.State,
      City: customer.City,
      Zip: customer.Zip,
    }));

    return NextResponse.json(transformedCustomers);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json([]);
  }
}
