import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const existing = await prisma.office.findFirst({
      where: orgWhere(session, { id: idNum }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    const office = await prisma.office.update({
      where: { id: idNum },
      data: { code, name },
    });

    return NextResponse.json(office);
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Office code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update office" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const idNum = parseInt(id, 10);

    const existing = await prisma.office.findFirst({
      where: orgWhere(session, { id: idNum }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Office not found" }, { status: 404 });
    }

    await prisma.office.delete({
      where: { id: idNum },
    });

    return NextResponse.json({ message: "Office deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete office" }, { status: 500 });
  }
}
