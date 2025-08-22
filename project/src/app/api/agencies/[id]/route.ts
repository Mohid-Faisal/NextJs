import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PUT /api/agencies/[id] - Update agency
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const agency = await prisma.agency.update({
      where: { id },
      data: { code, name }
    });

    return NextResponse.json(agency);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Agency code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update agency" }, { status: 500 });
  }
}

// DELETE /api/agencies/[id] - Delete agency
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    await prisma.agency.delete({
      where: { id }
    });

    return NextResponse.json({ message: "Agency deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete agency" }, { status: 500 });
  }
}
