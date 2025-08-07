import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    // console.log("working");
    
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limitParam = searchParams.get("limit") || "10";
  const isAll = limitParam === "all";
  const limit = isAll ? undefined : parseInt(limitParam);
  const skip = isAll ? 0 : (page - 1) * (limit || 10);

  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("search")?.trim() || "";
  const sortField = searchParams.get("sortField") || "id";
  const sortOrder = searchParams.get("sortOrder") || "desc";

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

  // Validate sort field
  const validSortFields = ["id", "CompanyName", "PersonName", "Phone", "City", "Country", "ActiveStatus", "createdAt"];
  const validSortOrder = ["asc", "desc"];
  
  const finalSortField = validSortFields.includes(sortField) ? sortField : "id";
  const finalSortOrder = validSortOrder.includes(sortOrder) ? sortOrder : "desc";
  
  const findManyOptions: any = {
    where,
    orderBy: { [finalSortField]: finalSortOrder },
  };

  // Only add skip and take if not fetching all
  if (!isAll) {
    findManyOptions.skip = skip;
    findManyOptions.take = limit;
  }

  const [customers, total] = await Promise.all([
    prisma.customers.findMany(findManyOptions),
    prisma.customers.count({ where }),
  ]);

//   console.log("customers",customers);


  return NextResponse.json({ customers, total });
}
