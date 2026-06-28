import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const vendors = await prisma.vendors.findMany({
      where: orgWhere(session),
      select: {
        id: true,
        CompanyName: true,
      },
      orderBy: {
        CompanyName: "asc",
      },
    });

    return NextResponse.json(vendors);
  } catch (error) {
    console.error("Failed to fetch vendors:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
