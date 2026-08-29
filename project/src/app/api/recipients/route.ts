import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Country } from "country-state-city";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { parseListPaging } from "@/lib/money";

export async function GET(req: Request) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const { searchParams } = new URL(req.url);
  const { take: limit, skip } = parseListPaging(searchParams, 10);

  const status = searchParams.get("status") || undefined;
  const onlyRemote = searchParams.get("onlyRemote") === "true";
  const search = searchParams.get("search")?.trim() || "";
  const sortField = searchParams.get("sortField") || "id";
  const sortOrder = searchParams.get("sortOrder") || "desc";

  const where: any = { ...orgWhere(session) };

  if (status) where.ActiveStatus = status;
  if (onlyRemote) where.isRemoteArea = true;

  // Fuzzy search across specific columns only
  if (search) {
    // First, try to find country codes that match the search term
    const matchingCountries = Country.getAllCountries().filter(country =>
      country.name.toLowerCase().includes(search.toLowerCase()) ||
      country.isoCode.toLowerCase().includes(search.toLowerCase())
    );
    
    const countryCodes = matchingCountries.map(country => country.isoCode);
    
    where.OR = [
      { CompanyName: { contains: search} },
      { PersonName: { contains: search} },
      { Phone: { contains: search} },
      { City: { contains: search} },
      { Country: { contains: search} },
    ];
    
    // If we found matching country codes, also search for those
    if (countryCodes.length > 0) {
      where.OR.push({ Country: { in: countryCodes } });
    }
  }

  // Validate sort field
  const validSortFields = ["id", "CompanyName", "PersonName", "Phone", "City", "Country", "createdAt"];
  const validSortOrder = ["asc", "desc"];
  
  const finalSortField = validSortFields.includes(sortField) ? sortField : "id";
  const finalSortOrder = validSortOrder.includes(sortOrder) ? sortOrder : "desc";

  const findManyOptions: any = {
    where,
    orderBy: { [finalSortField]: finalSortOrder },
    skip,
    take: limit,
  };

  const [recipients, total, remoteTotal] = await Promise.all([
    prisma.recipients.findMany(findManyOptions),
    prisma.recipients.count({ where }),
    prisma.recipients.count({ where: { ...where, isRemoteArea: true } }),
  ]);

//   console.log("customers",customers);
  return NextResponse.json({ recipients, total, remoteTotal });
}
