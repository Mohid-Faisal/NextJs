import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

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
    // console.log(Company, Address, City, Country, Contact, Email, ActiveStatus, SpecialInstructions);
    // Basic validation
    const requiredFields = ["companyname", "country"];

    const existingVendor = await prisma.vendors.findFirst({
      where: orgWhere(session, {
        CompanyName: companyname,
      }),
    });

    if (existingVendor) {
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
    const vendor = await prisma.vendors.create({
      data: orgData(session, {
        CompanyName: companyname,
        PersonName: personname,
        Email: email,
        Phone: phone,
        Country: country,
        State: state,
        City: city,
        Zip: zip,
        Address: address,
      }),
    });

    return NextResponse.json({
      success: true,
      message: "Vendor added successfully.",
      vendor,
    });
  } catch (error) {
    console.error("Add vendor error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to add vendor." },
      { status: 500 }
    );
  }
}
