import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/agencies - Get all agencies
export async function GET() {
  try {
    const agencies = await prisma.agency.findMany({
      orderBy: { code: 'asc' }
    });
    return NextResponse.json(agencies);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch agencies" }, { status: 500 });
  }
}

// POST /api/agencies - Create new agency
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "Code and name are required" }, { status: 400 });
    }

    const agency = await prisma.agency.create({
      data: { code, name }
    });

    return NextResponse.json(agency);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Agency code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create agency" }, { status: 500 });
  }
}
