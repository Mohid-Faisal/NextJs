import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";

const MANAGE_ROLES = ["OWNER", "ADMIN"];

/** GET /api/org/current — current org details for any member. */
export async function GET(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  try {
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        currency: true,
        logoUrl: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            trialEndsAt: true,
            plan: { select: { code: true, name: true, maxUsers: true, maxShipmentsPerMonth: true, features: true } },
          },
        },
      },
    });
    if (!org) {
      return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, organization: org, role: session.orgRole });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch organization" }, { status: 500 });
  }
}

/** PATCH /api/org/current — update name, logo, currency. OWNER/ADMIN only. */
export async function PATCH(req: NextRequest) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  if (!MANAGE_ROLES.includes(session.orgRole)) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data: { name?: string; logoUrl?: string | null; currency?: string } = {};

    if (typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (!trimmed) {
        return NextResponse.json({ success: false, error: "Name cannot be empty" }, { status: 400 });
      }
      data.name = trimmed;
    }
    if (typeof body.currency === "string" && body.currency.trim()) {
      data.currency = body.currency.trim().toUpperCase().slice(0, 8);
    }
    if (body.logoUrl === null || typeof body.logoUrl === "string") {
      const logo = typeof body.logoUrl === "string" ? body.logoUrl.trim() : null;
      data.logoUrl = logo || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.organization.update({
      where: { id: session.organizationId },
      data,
      select: { id: true, name: true, slug: true, status: true, currency: true, logoUrl: true },
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json({ success: false, error: "Failed to update organization" }, { status: 500 });
  }
}
