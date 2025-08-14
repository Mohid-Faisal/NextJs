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
    const recipients = await prisma.recipients.findMany({
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
    const transformedRecipients = recipients.map(recipient => ({
      id: recipient.id,
      Company: recipient.CompanyName, // Map CompanyName to Company
      PersonName: recipient.PersonName,
      Email: recipient.Email,
      Phone: recipient.Phone,
      Address: recipient.Address,
      Country: recipient.Country,
      State: recipient.State,
      City: recipient.City,
      Zip: recipient.Zip,
    }));

//   console.log(recipients)

    return NextResponse.json(transformedRecipients);
  } catch (error) {
    console.error("Error fetching recipients:", error);
    return NextResponse.json([]);
  }
}
