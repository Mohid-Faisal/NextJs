import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma"; // adjust import path based on your setup

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const company = formData.get("company") as string;

    if (!file || !company) {
      return NextResponse.json(
        { success: false, message: "Missing file or company" },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Please upload an Excel file." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: "buffer" });

    if (workbook.SheetNames.length < 2) {
      return NextResponse.json(
        { success: false, message: "Expected at least two sheets in Excel file." },
        { status: 400 }
      );
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[1]];
    const rawJson = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });

    const dataRows = rawJson.slice(4).filter(row => row.length >= 5);

    const parsedZones = dataRows.map(row => ({
      code: row[0]?.toString().trim(),
      country: row[2]?.toString().trim(),
      zone: row[4]?.toString().trim(),
      company: company.toLowerCase(),
    })).filter(item => item.code && item.country && item.zone);

    // Optional: Delete previous entries for this company
    await prisma.zone.deleteMany({
      where: {
        company: company.toLowerCase(),
      },
    });

    // Insert all parsed rows into DB
    await prisma.zone.createMany({
      data: parsedZones,
      skipDuplicates: true, // optional
    });

    return NextResponse.json({
      success: true,
      message: `Zone list uploaded successfully for ${company}`,
      count: parsedZones.length,
    });

  } catch (error) {
    console.error("❌ Error uploading zone list:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error processing file",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company");

  if (!company) {
    return NextResponse.json({ success: false, message: "Company not specified", data: [] });
  }

  const zones = await prisma.zone.findMany({
    where: {
      company: company.toLowerCase(),
    },
  });

  if (zones.length === 0) {
    return NextResponse.json({ success: false, message: "No zones found for company", data: [] });
  }

  return NextResponse.json({ success: true, data: zones });
}
