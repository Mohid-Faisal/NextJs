import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const modelMap: Record<string, any> = {
  deliveryTime: prisma.deliveryTime,
  paymentMethod: prisma.paymentMethod,
  deliveryStatus: prisma.deliveryStatus,
  shippingMode: prisma.shippingMode,
  packagingType: prisma.packagingType,
  courierCompany: prisma.courierCompany,
  serviceMode: prisma.serviceMode,
};

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json([], { status: 400 });

  const data = await model.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const { name } = await req.json();
  const created = await model.create({ data: { name } });
  return NextResponse.json(created);
}

export async function DELETE(req: NextRequest, { params }: { params: { type: string } }) {
  const {type} = await params
  const model = modelMap[type];
  if (!model) return NextResponse.json({ error: "Invalid type" }, { status: 400 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  await model.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
