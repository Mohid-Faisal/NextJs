import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const vendorServices = await prisma.vendorservice.findMany({
      orderBy: { id: "asc" },
    });

    return NextResponse.json(vendorServices);
  } catch (error) {
    console.error("Error fetching vendor services:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendor services" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendor, service } = body;

    console.log(body);

    if (!vendor || !service) {
      return NextResponse.json(
        { error: "Vendor and service are required" },
        { status: 400 }
      );
    }

    // Check if the vendor-service combination already exists
    const existing = await prisma.vendorservice.findFirst({
      where: {
        vendor: vendor,
        service: service,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This vendor-service combination already exists" },
        { status: 400 }
      );
    }

    const vendorService = await prisma.vendorservice.create({
      data: {
        vendor: vendor,
        service: service,
      },
    });

    return NextResponse.json(vendorService);
  } catch (error) {
    console.error("Error creating vendor service:", error);
    return NextResponse.json(
      { error: "Failed to create vendor service" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "ID is required" },
        { status: 400 }
      );
    }

    await prisma.vendorservice.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vendor service:", error);
    return NextResponse.json(
      { error: "Failed to delete vendor service" },
      { status: 500 }
    );
  }
} 