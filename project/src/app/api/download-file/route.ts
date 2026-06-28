import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");
    const service = searchParams.get("service");

    if (!filename || !service) {
      return NextResponse.json(
        { success: false, message: "Filename and service are required" },
        { status: 400 }
      );
    }

    const fileRecord = await prisma.filename.findFirst({
      where: orgWhere(session, {
        filename: filename,
        service: service.toLowerCase(),
      }),
    });

    if (!fileRecord) {
      return NextResponse.json(
        { success: false, message: "File not found in database" },
        { status: 404 }
      );
    }

    const zoneData = await prisma.zone.findMany({
      where: orgWhere(session, {
        service: service.toLowerCase(),
      }),
    });

    if (zoneData.length === 0) {
      return NextResponse.json(
        { success: false, message: "No zone data found for this service" },
        { status: 404 }
      );
    }

    const csvContent = [
      "Code,Country,Zone,Phone Code",
      ...zoneData.map(zone => 
        `${zone.code || ""},${zone.country},${zone.zone},${(zone as any).phoneCode || ""}`
      )
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename.replace(/\.(xlsx|xls)$/, '.csv')}"`,
      },
    });

  } catch (error) {
    console.error("❌ Error downloading file:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error downloading file",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
