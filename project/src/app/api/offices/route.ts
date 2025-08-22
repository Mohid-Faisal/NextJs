import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/offices - Get all offices
export async function GET() {
  try {
    const offices = await prisma.office.findMany({
      orderBy: { code: 'asc' }
    });
    return NextResponse.json(offices);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch offices" }, { status: 500 });
  }
}

// POST /api/offices - Create new office
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const office = await prisma.office.create({
      data: { code, name }
    });

    return NextResponse.json(office);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Office code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create office" }, { status: 500 });
  }
}
