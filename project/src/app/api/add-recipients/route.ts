import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const {
      Company,
      Address,
      City,
      Country,
      Contact,
      Email,
      ActiveStatus,
      SpecialInstructions,
    } = await req.json();

    console.log(Email);
    // Basic validation
    const requiredFields = [
      "Company",
      "Address",
      "City",
      "Country",
      "Contact",
      "Email",
      "ActiveStatus",
      "SpecialInstructions",
    ];

    const existingRecipient = await prisma.recipients.findUnique({
      where: {
        Email: Email,
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
        Company,
        Address,
        City,
        Country,
        Contact,
        Email,
        ActiveStatus,
        SpecialInstructions,
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
