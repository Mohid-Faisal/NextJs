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

    const existingCustomer = await prisma.customers.findUnique({
      where: {
        Email: Email,
      },
    });
    
    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer already exists." },
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
    const customer = await prisma.customers.create({
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
      message: "Customer added successfully.",
      customer,
    });
  } catch (error) {
    console.error("Add customer error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add customer." },
      { status: 500 }
    );
  }
}
