import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeToken } from "@/lib/utils";
import bcrypt from "bcrypt";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const recipientId = parseInt(params.id);
    
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
  { params }: { params: { id: string } }
) {
  try {
    const recipientId = parseInt(params.id);
    
    if (isNaN(recipientId)) {
      return NextResponse.json(
        { error: "Invalid recipient ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    
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
  { params }: { params: { id: string } }
) {
  try {
    const recipientId = parseInt(params.id);
    
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
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await req.json();

    const updatedRecipient = await prisma.recipients.update({
      where: { id },
      data: {
        Address: body.Address,
        City: body.City,
        State: body.State,
        Country: body.Country,
        Zip: body.Zip,
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