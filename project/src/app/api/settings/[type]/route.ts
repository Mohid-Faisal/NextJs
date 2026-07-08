import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";

const modelMap: Record<string, any> = {
  deliveryTime: prisma.deliveryTime,
  deliveryStatus: prisma.deliveryStatus,
  shippingMode: prisma.shippingMode,
  packagingType: prisma.packagingType,
  serviceMode: prisma.serviceMode,
  hscodes: prisma.hsCode,
};

const orderByMap: Record<string, any> = {
  deliveryStatus: { order: "asc" },
  hscodes: { code: "asc" },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json([], { status: 400 });

  const data = await model.findMany({
    where: orgWhere(session),
    orderBy: orderByMap[type] ?? { name: "asc" },
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  try {
    const body = await req.json();
    const { id, createdAt, organizationId, ...dataFields } = body;
    const created = await model.create({ data: orgData(session, dataFields) });
    return NextResponse.json(created);
  } catch (error: any) {
    console.error(`Error creating ${type}:`, error);
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Record already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  try {
    const body = await req.json();
    const { id, createdAt, organizationId, ...dataFields } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const existing = await model.findFirst({
      where: orgWhere(session, { id: typeof id === 'string' ? parseInt(id) : id }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await model.update({
      where: { id: existing.id },
      data: dataFields
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Error updating ${type}:`, error);
    if ((error as any)?.code === "P2002") {
      return NextResponse.json({ error: "Record already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const auth = await requireApiSession(req);
  if (auth.error) return auth.error;
  const session = auth.session;

  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    const recordId = parseInt(id);
    const existing = await model.findFirst({
      where: orgWhere(session, { id: recordId }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // For serviceMode, cascade-delete zones, rates, and related records
    if (type === "serviceMode") {
      const svc = existing.name.toLowerCase();
      const orgId = session.organizationId;
      const [deletedZones, deletedRates] = await Promise.all([
        prisma.zone.deleteMany({
          where: {
            organizationId: orgId,
            service: { equals: svc},
          },
        }),
        prisma.rate.deleteMany({
          where: {
            organizationId: orgId,
            service: { equals: svc},
          },
        }),
      ]);

      await Promise.all([
        prisma.$executeRaw`DELETE FROM "ZoneUpload" WHERE "organizationId" = ${orgId} AND LOWER("service") = ${svc}`.catch(() => {}),
        prisma.$executeRaw`DELETE FROM "filename" WHERE "organizationId" = ${orgId} AND LOWER("service") = ${svc}`.catch(() => {}),
        prisma.vendorservice.deleteMany({
          where: {
            organizationId: orgId,
            service: { equals: svc},
          },
        }),
      ]);

      console.log(
        `Cascade delete for serviceMode "${existing.name}": ${deletedZones.count} zones, ${deletedRates.count} rates removed`
      );
    }

    await model.delete({ where: { id: recordId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting ${type} with id ${id}:`, error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
