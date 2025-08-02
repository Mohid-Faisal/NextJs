// app/api/rates/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

// In-memory store: { companyId: [rates] }
const rateStore: Record<string, any[]> = {};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const company = formData.get("company") as string;

  if (!file || !company) {
    return NextResponse.json({ success: false, message: "Missing file or company" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(worksheet);

  rateStore[company] = json;

  return NextResponse.json({ success: true, message: "Rate list uploaded" });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");

  if (!company || !rateStore[company]) {
    return NextResponse.json({ success: false, data: [] });
  }

  return NextResponse.json({ success: true, data: rateStore[company] });
}
