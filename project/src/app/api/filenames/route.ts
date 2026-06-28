import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const { filename, vendor, service } = body;

    if (!filename || !vendor || !service) {
      return NextResponse.json(
        { success: false, message: "Missing filename, vendor, or service" },
        { status: 400 }
      );
    }

    // Delete existing filename record for this vendor-service combination
    await prisma.filename.deleteMany({
      where: orgWhere(session, {
        vendor: vendor,
        service: service,
      }),
    });

    // Store new filename
    await prisma.filename.create({
      data: orgData(session, {
        filename: filename,
        vendor: vendor,
        service: service,
        fileType: "rate",
      }),
    });

    return NextResponse.json({
      success: true,
      message: "Filename stored successfully",
    });
  } catch (error) {
    console.error("❌ Error storing filename:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error storing filename",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const vendor = searchParams.get("vendor");
    const service = searchParams.get("service");

    // If no vendor and service provided, return all filenames
    if (!vendor && !service) {
      const allFilenames = await prisma.filename.findMany({
        where: orgWhere(session, {
          fileType: "rate"
        }),
        orderBy: {
          vendor: 'asc'
        }
      });

      return NextResponse.json({
        success: true,
        data: allFilenames,
      });
    }

    // If vendor and service are provided, return specific filename
    if (!vendor || !service) {
      return NextResponse.json({
        success: false,
        message: "Both vendor and service are required when querying specific filename",
        data: null,
      });
    }

    const filenameRecord = await prisma.filename.findFirst({
      where: orgWhere(session, {
        vendor: vendor,
        service: service,
        fileType: "rate"
      }),
    });

    return NextResponse.json({
      success: true,
      data: filenameRecord,
    });
  } catch (error) {
    console.error("❌ Error retrieving filename:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error retrieving filename",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
} 