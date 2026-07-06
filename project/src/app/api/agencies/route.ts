import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { checkBranchLimit } from "@/lib/billing/usage";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const agencies = await prisma.agency.findMany({
      where: orgWhere(session),
      orderBy: { code: "asc" },
    });
    return NextResponse.json(agencies);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch agencies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const limitCheck = await checkBranchLimit(session.organizationId);
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 403 });
    }

    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const agency = await prisma.agency.create({
      data: orgData(session, { code, name }),
    });

    return NextResponse.json(agency);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Agency code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create agency" }, { status: 500 });
  }
}
