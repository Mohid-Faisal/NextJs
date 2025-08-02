import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const {
      companyname,
      personname,
      email,
      phone,
      country,
      state,
      city,
      zip,
      address,
    } = await req.json();

    // console.log(companyname, personname, email, phone, country, state, city, zip, address);

    // console.log(Email);
    // Basic validation
    const requiredFields = [
      "companyname",
      "country", 
    ];

    const existingRecipient = await prisma.recipients.findUnique({
      where: {
        CompanyName: companyname,
      },
    });
    
    if (existingRecipient) {
      return NextResponse.json(
        { success: false, message: "Recipient already exists." },
        { status: 400 }
      );
    }

    for (const field of requiredFields) {
      if (!eval(field)) {
        return NextResponse.json(
          { success: false, message: `${field} is required.` },
          { status: 400 }
        );
      }
    }

    // Store shipment in the database
    const recipient = await prisma.recipients.create({
      data: {
        CompanyName: companyname,
        PersonName: personname,
        Email: email,
        Phone: phone,
        Country: country,
        State: state,
        City: city,
        Zip: zip,
        Address: address,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Recipient added successfully.",
      recipient,
    });
  } catch (error) {
    console.error("Add recipient error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add recipient." },
      { status: 500 }
    );
  }
}
