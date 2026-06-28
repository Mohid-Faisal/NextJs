import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const zoneFiles = await prisma.filename.findMany({
      where: orgWhere(session, {
        fileType: "zone",
      }),
      select: {
        id: true,
        filename: true,
        service: true,
        uploadedAt: true,
      },
      orderBy: {
        service: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      data: zoneFiles,
    });
  } catch (error) {
    console.error("Failed to fetch available zones:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch available zones" },
      { status: 500 }
    );
  }
}
