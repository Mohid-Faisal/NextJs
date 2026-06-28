import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const offices = await prisma.office.findMany({
      where: orgWhere(session),
      orderBy: { code: "asc" },
    });
    return NextResponse.json(offices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch offices" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const office = await prisma.office.create({
      data: orgData(session, { code, name }),
    });

    return NextResponse.json(office);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Office code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create office" }, { status: 500 });
  }
}
