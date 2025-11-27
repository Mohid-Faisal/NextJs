import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const modelMap: Record<string, any> = {
  deliveryTime: prisma.deliveryTime,
  deliveryStatus: prisma.deliveryStatus,
  shippingMode: prisma.shippingMode,
  packagingType: prisma.packagingType,
  serviceMode: prisma.serviceMode,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json([], { status: 400 });

  const data = await model.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const { name }: { name: string } = await req.json();
  const created = await model.create({ data: { name } });
  return NextResponse.json(created);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  try {
    const body: { id: string | number; name: string } = await req.json();
    const { id, name } = body;
    
    if (!id || !name) {
      return NextResponse.json({ error: "Missing ID or name" }, { status: 400 });
    }

    const updated = await model.update({
      where: { id: typeof id === 'string' ? parseInt(id) : id },
      data: { name }
    });
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Error updating ${type}:`, error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  try {
    await model.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`Error deleting ${type} with id ${id}:`, error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
