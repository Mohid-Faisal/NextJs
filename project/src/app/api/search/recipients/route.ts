import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Country } from "country-state-city";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
//   console.log(searchParams,query)
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  try {
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(query.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(query.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    
    const recipients = await prisma.recipients.findMany({
      where: {
        OR: [
          { CompanyName: { contains: query, mode: "insensitive" } },
          { PersonName: { contains: query, mode: "insensitive" } },
          { Email: { contains: query, mode: "insensitive" } },
          { Phone: { contains: query, mode: "insensitive" } },
          { Country: { contains: query, mode: "insensitive" } },
          ...(countryCodes.length > 0 ? [{ Country: { in: countryCodes } }] : []),
        ],
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
      }
    });
    
    // Transform the data to match frontend expectations
    const transformedRecipients = recipients.map(recipient => ({
      id: recipient.id,
      Company: recipient.CompanyName, // Map CompanyName to Company
      PersonName: recipient.PersonName,
      Email: recipient.Email,
      Phone: recipient.Phone,
      Address: recipient.Address,
      Country: recipient.Country,
    }));

//   console.log(recipients)

    return NextResponse.json(transformedRecipients);
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return NextResponse.json([]);
  }
}
