import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decodeToken } from "@/lib/utils";
import bcrypt from "bcrypt";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = parseInt(params.id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const vendor = await prisma.vendors.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ vendor });
  } catch (error) {
    console.error("Error fetching vendor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = parseInt(params.id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    
    const updatedVendor = await prisma.vendors.update({
      where: { id: vendorId },
      data: {
        CompanyName: body.companyname,
        PersonName: body.personname,
        Email: body.email,
        Phone: body.phone,
        Country: body.country,
        State: body.state,
        City: body.city,
        Zip: body.zip,
        Address: body.address,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Vendor updated successfully",
      vendor: updatedVendor 
    });
  } catch (error) {
    console.error("Error updating vendor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vendorId = parseInt(params.id);
    
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authorization token required" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    // Get the request body for password verification
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required for deletion" },
        { status: 400 }
      );
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Verify the password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    // Check if vendor exists
    const vendor = await prisma.vendors.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      );
    }

    // Delete the vendor
    await prisma.vendors.delete({
      where: { id: vendorId },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Vendor deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting vendor:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 