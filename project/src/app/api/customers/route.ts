import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    // console.log("working");
    
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;

  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";

  const where: any = {};

  if (status) where.ActiveStatus = status;

  // Fuzzy search
  if (search) {
    where.OR = [
      { CompanyName: { contains: search, mode: "insensitive" } },
      { PersonName: { contains: search, mode: "insensitive" } },
      { Email: { contains: search, mode: "insensitive" } },
      { Phone: { contains: search, mode: "insensitive" } },
      { Address: { contains: search, mode: "insensitive" } },
    ];
  }
  
  const [customers, total] = await Promise.all([
    prisma.customers.findMany({
      skip,
      take: limit,
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        CompanyName: true,
        PersonName: true,
        Phone: true,
        City: true,
        Country: true,
      },
    }),
    prisma.customers.count({ where }),
  ]);

//   console.log("customers",customers);


  return NextResponse.json({ customers, total });
}
