import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const vendorServices = await prisma.vendorservice.findMany({
      where: orgWhere(session),
      orderBy: [{ vendor: "asc" }, { service: "asc" }],
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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const { vendor, service } = body;

    if (!vendor || !service) {
      return NextResponse.json(
        { error: "Vendor and service are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.vendorservice.findFirst({
      where: orgWhere(session, { vendor, service }),
    });

    if (existing) {
      return NextResponse.json(
        { error: "This vendor-service combination already exists" },
        { status: 400 }
      );
    }

    const vendorService = await prisma.vendorservice.create({
      data: orgData(session, { vendor, service }),
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
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const record = await prisma.vendorservice.findFirst({
      where: orgWhere(session, { id: parseInt(id, 10) }),
    });

    if (!record) {
      return NextResponse.json(
        { error: "Vendor service not found" },
        { status: 404 }
      );
    }

    const [deletedRates] = await Promise.all([
      prisma.rate.deleteMany({
        where: orgWhere(session, {
          vendor: { equals: record.vendor, mode: "insensitive" },
          service: { equals: record.service, mode: "insensitive" },
        }),
      }),
      prisma.filename.deleteMany({
        where: orgWhere(session, {
          vendor: { equals: record.vendor, mode: "insensitive" },
          service: { equals: record.service, mode: "insensitive" },
          fileType: "rate",
        }),
      }).catch(() => {}),
    ]);

    console.log(
      `Cascade delete for vendorService "${record.vendor} → ${record.service}": ${deletedRates.count} rates removed`
    );

    await prisma.vendorservice.delete({
      where: { id: parseInt(id, 10) },
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
