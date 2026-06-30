import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_vendors");
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
    if (!companyname || String(companyname).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Company Name is required." },
        { status: 400 }
      );
    }
    if (!personname || String(personname).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Person Name is required." },
        { status: 400 }
      );
    }
    if (!country || String(country).trim() === "") {
      return NextResponse.json(
        { success: false, message: "Country is required." },
        { status: 400 }
      );
    }

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
