import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
//   console.log(searchParams,query)
  if (!query) {
    return NextResponse.json([]);
  }

  const recipients = await prisma.recipients.findMany({
    where: {
      Company: {
        contains: query,
        mode: "insensitive",
      },
    },
    take: 10,
    select: {
        id: true,
        Company: true,
        Address: true,
      }
  });
  
//   console.log(recipients)

  return NextResponse.json(recipients);
}
