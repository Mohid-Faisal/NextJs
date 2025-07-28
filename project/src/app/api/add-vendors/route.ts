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
    // console.log(Company, Address, City, Country, Contact, Email, ActiveStatus, SpecialInstructions);
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

    const existingCustomer = await prisma.vendors.findUnique({
      where: {
        Email: Email,
      },
    });
    
    if (existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Vendor already exists." },
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
    const customer = await prisma.vendors.create({
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
      message: "Vendor added successfully.",
      customer,
    });
  } catch (error) {
    console.error("Add vendor error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add vendor." },
      { status: 500 }
    );
  }
}
