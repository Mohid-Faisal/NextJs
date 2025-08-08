import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { decodeToken } from "@/lib/utils";
import bcrypt from "bcrypt";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = parseInt(params.id);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: "Invalid shipment ID" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }
    return NextResponse.json({ shipment });
  } catch (error) {
    console.error("Error fetching shipment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const shipmentId = parseInt(params.id);
    if (isNaN(shipmentId)) {
      return NextResponse.json({ error: "Invalid shipment ID" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization token required" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = decodeToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { password } = body || {};
    if (!password) {
      return NextResponse.json({ error: "Password is required for deletion" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: parseInt(decoded.id) } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const exists = await prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!exists) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await prisma.shipment.delete({ where: { id: shipmentId } });
    return NextResponse.json({ success: true, message: "Shipment deleted successfully" });
  } catch (error) {
    console.error("Error deleting shipment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


