import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Helper function to decode JWT token
function decodeToken(token: string) {
  try {
    const secret = process.env.JWT_SECRET || "your-secret-key";
    return jwt.verify(token, secret) as { id: string; [key: string]: unknown };
  } catch (error) {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);

    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json(
      { error: "Failed to fetch shipment" },
      { status: 500 }
    );
  }
}

// export async function PUT(
//   request: NextRequest,
//   { params }: { params: { id: string } }
// ) {
//   try {
//     const shipmentId = parseInt(params.id);
//     const body = await request.json();

//     // Get the shipment to verify it exists
//     const existingShipment = await prisma.shipment.findUnique({
//       where: { id: shipmentId },
//     });

//     if (!existingShipment) {
//       return NextResponse.json(
//         { success: false, message: "Shipment not found" },
//         { status: 404 }
//       );
//     }

//     // Update the shipment
//     const updatedShipment = await prisma.shipment.update({
//       where: { id: shipmentId },
//       data: {
//         awbNumber: body.awbNumber,
//         senderName: body.senderName,
//         senderPhone: body.senderPhone,
//         senderAddress: body.senderAddress,
//         recipientName: body.recipientName,
//         recipientPhone: body.recipientPhone,
//         recipientAddress: body.recipientAddress,
//         destination: body.destination,
//         weight: body.weight,
//         dimensions: body.dimensions,
//         description: body.description,
//         deliveryStatus: body.deliveryStatus,
//         invoiceStatus: body.invoiceStatus,
//         totalCost: body.totalCost,
//         notes: body.notes,
//       },
//     });

//     return NextResponse.json({
//       success: true,
//       message: "Shipment updated successfully",
//       data: updatedShipment,
//     });
//   } catch (error) {
//     console.error("Update shipment error:", error);
//     return NextResponse.json(
//       { success: false, message: "Failed to update shipment" },
//       { status: 500 }
//     );
//   }
// }

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shipmentId = parseInt(id);
    
    if (isNaN(shipmentId)) {
      return NextResponse.json(
        { error: "Invalid shipment ID" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get("authorization");
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
    const body: { password: string } = await request.json();
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

    // Check if shipment exists
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 }
      );
    }

    // Delete the shipment
    await prisma.shipment.delete({
      where: { id: shipmentId },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Shipment deleted successfully" 
    });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
