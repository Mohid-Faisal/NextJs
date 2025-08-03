import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const vendors = await prisma.vendors.findMany({
      select: {
        id: true,
        CompanyName: true,
      },
      orderBy: {
        CompanyName: "asc",
      },
    });
    // console.log(vendors);
    
    return NextResponse.json(vendors);
  } catch (error) {
    console.error("Failed to fetch vendors:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}
