import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import type { SessionPayload } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const weight = searchParams.get("weight");

    const whereClause: any = { ...orgWhere(session) };

    if (weight) {
      whereClause.weight = parseFloat(weight);
    }

    const fixedCharges = await prisma.fixedCharge.findMany({
      where: whereClause,
      orderBy: { weight: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: fixedCharges,
      count: fixedCharges.length,
    });
  } catch (error) {
    console.error("Error fetching fixed charges:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch fixed charges data" },
      { status: 500 }
    );
  }
}

// POST - Create new fixed charge entries or upload from Excel
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const contentType = req.headers.get("content-type");

    if (contentType?.includes("multipart/form-data")) {
      return await handleExcelUpload(req, session);
    }
    return await handleJsonData(req, session);
  } catch (error) {
    console.error("Error creating fixed charge:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create fixed charge data" },
      { status: 500 }
    );
  }
}

// PUT - Update fixed charge entry
export async function PUT(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await req.json();
    const { id, weight, fixedCharge } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required for update" },
        { status: 400 }
      );
    }

    const existing = await prisma.fixedCharge.findFirst({
      where: orgWhere(session, { id: parseInt(String(id), 10) }),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Fixed charge not found" },
        { status: 404 }
      );
    }

    const updatedCharge = await prisma.fixedCharge.update({
      where: { id: parseInt(id) },
      data: {
        weight: weight ? parseFloat(weight) : undefined,
        fixedCharge: fixedCharge ? parseFloat(fixedCharge) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Fixed charge updated successfully",
      data: updatedCharge,
    });
  } catch (error) {
    console.error("Error updating fixed charge:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update fixed charge" },
      { status: 500 }
    );
  }
}

// DELETE - Delete fixed charge entry
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiSession(req);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID is required for deletion" },
        { status: 400 }
      );
    }

    const existing = await prisma.fixedCharge.findFirst({
      where: orgWhere(session, { id: parseInt(id, 10) }),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: "Fixed charge not found" },
        { status: 404 }
      );
    }

    await prisma.fixedCharge.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({
      success: true,
      message: "Fixed charge deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting fixed charge:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete fixed charge" },
      { status: 500 }
    );
  }
}

// Helper function to handle Excel file upload
async function handleExcelUpload(req: NextRequest, session: SessionPayload) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json(
      { success: false, message: "File is required" },
      { status: 400 }
    );
  }

  const allowedTypes = [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid file type. Please upload an Excel file.",
      },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

  console.log("📋 Raw Excel data:", raw.slice(0, 10));

  const fixedChargeData: {
    weight: number;
    fixedCharge: number;
  }[] = [];

  // Parse the Excel data
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    
    // Skip empty rows
    if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === "")) {
      continue;
    }

    // Check if this row contains headers
    if (i === 0) {
      const headers = row.map((cell: any) => cell?.toString().toLowerCase() || "");
      console.log("📋 Headers found:", headers);
      continue;
    }

    // Process data rows (skip header row)
    if (i > 0 && row.length >= 2) {
      const weight = parseFloat(row[0]);
      const fixedCharge = parseFloat(row[1]);

      if (!isNaN(weight) && !isNaN(fixedCharge)) {
        fixedChargeData.push({
          weight,
          fixedCharge,
        });
      }
    }
  }

  console.log("📋 Parsed data:", fixedChargeData.slice(0, 5));

  if (fixedChargeData.length === 0) {
    return NextResponse.json(
      { success: false, message: "No valid data found in the Excel file" },
      { status: 400 }
    );
  }

  // Insert data into database
  const results = [];
  for (const data of fixedChargeData) {
    try {
      const result = await prisma.fixedCharge.create({
        data: orgData(session, {
          weight: data.weight,
          fixedCharge: data.fixedCharge,
        }),
      });
      results.push(result);
    } catch (error) {
      console.error(`Error creating fixed charge for weight ${data.weight}:`, error);
    }
  }

  return NextResponse.json({
    success: true,
    message: `Successfully processed ${results.length} fixed charge entries`,
    data: results,
    count: results.length,
  });
}

// Helper function to handle JSON data
async function handleJsonData(req: NextRequest, session: SessionPayload) {
  const body = await req.json();
  const { weight, fixedCharge } = body;

  if (!weight || !fixedCharge) {
    return NextResponse.json(
      { success: false, message: "Weight and fixedCharge are required" },
      { status: 400 }
    );
  }

  const newCharge = await prisma.fixedCharge.create({
    data: orgData(session, {
      weight: parseFloat(weight),
      fixedCharge: parseFloat(fixedCharge),
    }),
  });

  return NextResponse.json({
    success: true,
    message: "Fixed charge created successfully",
    data: newCharge,
  });
}
