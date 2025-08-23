import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PUT /api/offices/[id] - Update office
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const office = await prisma.office.update({
      where: { id: idNum },
      data: { code, name }
    });

    return NextResponse.json(office);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Office code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update office" }, { status: 500 });
  }
}

// DELETE /api/offices/[id] - Delete office
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    await prisma.office.delete({
      where: { id: idNum }
    });

    return NextResponse.json({ message: "Office deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete office" }, { status: 500 });
  }
}
