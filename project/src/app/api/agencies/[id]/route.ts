import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { withAuth } from "@/lib/api/withAuth";

const updateAgencySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
});

export const PUT = withAuth(
  {
    permission: "manage_services",
    bodySchema: updateAgencySchema,
    limit: { requests: 60, windowMs: 60 * 1000 },
  },
  async ({ session, body, params }) => {
    const idNum = parseInt(params.id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid agency ID" }, { status: 400 });
    }

    const existing = await prisma.agency.findFirst({
      where: orgWhere(session, { id: idNum }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    try {
      const agency = await prisma.agency.update({
        where: { id: idNum },
        data: { code: body.code, name: body.name },
      });
      return NextResponse.json(agency);
    } catch (error: any) {
      if (error?.code === "P2002") {
        return NextResponse.json({ error: "Agency code already exists" }, { status: 400 });
      }
      throw error;
    }
  }
);

export const DELETE = withAuth(
  {
    permission: "manage_services",
    limit: { requests: 60, windowMs: 60 * 1000 },
  },
  async ({ session, params }) => {
    const idNum = parseInt(params.id, 10);
    if (isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid agency ID" }, { status: 400 });
    }

    const existing = await prisma.agency.findFirst({
      where: orgWhere(session, { id: idNum }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Agency not found" }, { status: 404 });
    }

    await prisma.agency.delete({
      where: { id: idNum },
    });

    return NextResponse.json({ message: "Agency deleted successfully" });
  }
);
