import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeToken, checkRemoteArea } from "@/lib/utils";
import bcrypt from "bcrypt";

// Define proper types for the request body
interface RecipientUpdateData {
  companyname?: string;
  personname?: string;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;
  address?: string;
}

interface AddressUpdateData {
  Address?: string;
  City?: string;
  State?: string;
  Country?: string;
  Zip?: string;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipientId = parseInt(id);
    
    if (isNaN(recipientId)) {
      return NextResponse.json(
        { error: "Invalid recipient ID" },
        { status: 400 }
      );
    }

    const recipient = await prisma.recipients.findUnique({
      where: { id: recipientId },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Error fetching recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipientId = parseInt(id);
    
    if (isNaN(recipientId)) {
      return NextResponse.json(
        { error: "Invalid recipient ID" },
        { status: 400 }
      );
    }

    const body: RecipientUpdateData = await req.json();
    
    // Check if location is a remote area (use existing values if not provided in update)
    const recipient = await prisma.recipients.findUnique({
      where: { id: recipientId },
    });
    
    const country = body.country || recipient?.Country || "";
    const city = body.city !== undefined ? body.city : recipient?.City;
    const zip = body.zip !== undefined ? body.zip : recipient?.Zip;
    
    const remoteAreaCheck = await checkRemoteArea(prisma, country, city, zip);
    
    const updatedRecipient = await prisma.recipients.update({
      where: { id: recipientId },
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
        isRemoteArea: remoteAreaCheck.isRemote,
        remoteAreaCompanies: remoteAreaCheck.companies.length > 0 
          ? JSON.stringify(remoteAreaCheck.companies) 
          : null,
      },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Recipient updated successfully",
      recipient: updatedRecipient 
    });
  } catch (error) {
    console.error("Error updating recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const recipientId = parseInt(id);
    
    if (isNaN(recipientId)) {
      return NextResponse.json(
        { error: "Invalid recipient ID" },
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
    const body: { password: string } = await req.json();
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

    // Check if recipient exists
    const recipient = await prisma.recipients.findUnique({
      where: { id: recipientId },
    });

    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }

    // Delete the recipient
    await prisma.recipients.delete({
      where: { id: recipientId },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Recipient deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting recipient:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const body: AddressUpdateData = await req.json();

    // Check if location is a remote area (use existing values if not provided in update)
    const recipient = await prisma.recipients.findUnique({
      where: { id: idNum },
    });
    
    const country = body.Country || recipient?.Country || "";
    const city = body.City !== undefined ? body.City : recipient?.City;
    const zip = body.Zip !== undefined ? body.Zip : recipient?.Zip;
    
    const remoteAreaCheck = await checkRemoteArea(prisma, country, city, zip);

    const updatedRecipient = await prisma.recipients.update({
      where: { id: idNum },
      data: {
        Address: body.Address,
        City: body.City,
        State: body.State,
        Country: body.Country,
        Zip: body.Zip,
        isRemoteArea: remoteAreaCheck.isRemote,
        remoteAreaCompanies: remoteAreaCheck.companies.length > 0 
          ? JSON.stringify(remoteAreaCheck.companies) 
          : null,
      },
    });

    return NextResponse.json({
      success: true,
      recipient: updatedRecipient,
    });
  } catch (error) {
    console.error("Error updating recipient:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update recipient" },
      { status: 500 }
    );
  }
} 