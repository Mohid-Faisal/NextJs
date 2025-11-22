import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

// Extract company name from filename
function extractCompanyName(filename: string): string {
  // Remove file extension
  let nameWithoutExt = filename.replace(/\.(xlsx|xls)$/i, '');
  
  // Common patterns to remove from filename
  const patternsToRemove = [
    /remote[-_\s]?area/i,
    /remote[-_\s]?areas/i,
    /remote/i,
    /area/i,
    /areas/i,
    /lookup/i,
    /data/i,
    /list/i,
  ];
  
  // Remove common patterns
  patternsToRemove.forEach(pattern => {
    nameWithoutExt = nameWithoutExt.replace(pattern, '');
  });
  
  // Clean up separators and whitespace
  nameWithoutExt = nameWithoutExt
    .replace(/[-_\s]+/g, ' ') // Replace multiple separators with single space
    .trim();
  
  // If empty after cleaning, use the original filename without extension
  if (!nameWithoutExt || nameWithoutExt.length === 0) {
    nameWithoutExt = filename.replace(/\.(xlsx|xls)$/i, '');
  }
  
  return nameWithoutExt || 'Unknown';
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const filename = file.name;
    const company = extractCompanyName(filename);

    if (!file) {
      return NextResponse.json(
        { success: false, message: "Missing file" },
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

    // Find header row (usually first row, but skip empty rows)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(10, raw.length); i++) {
      const row = raw[i];
      if (Array.isArray(row) && row.length > 0) {
        const firstCell = String(row[0] || "").toLowerCase();
        if (firstCell.includes("country") || firstCell.includes("iata") || firstCell === "country") {
          headerRowIndex = i;
          break;
        }
      }
    }

    const headerRow = raw[headerRowIndex] || [];
    
    // Find column indices
    const getColumnIndex = (header: string, alternatives: string[] = []) => {
      const searchTerms = [header, ...alternatives].map(h => h.toLowerCase());
      for (let i = 0; i < headerRow.length; i++) {
        const cell = String(headerRow[i] || "").toLowerCase().trim();
        if (searchTerms.some(term => cell.includes(term) || cell === term)) {
          return i;
        }
      }
      return -1;
    };

    const countryIndex = getColumnIndex("country", ["country"]);
    const iataIndex = getColumnIndex("iata", ["iata code", "iata", "code"]);
    const lowIndex = getColumnIndex("low", ["low"]);
    const highIndex = getColumnIndex("high", ["high"]);
    const cityIndex = getColumnIndex("city", ["city"]);

    if (countryIndex === -1 || iataIndex === -1 || lowIndex === -1 || highIndex === -1) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid file format. Required columns: Country, IATA Code, Low, High. City is optional.",
        },
        { status: 400 }
      );
    }

    const parsedAreas: {
      company: string;
      country: string;
      iataCode: string;
      low: string;
      high: string;
      city: string | null;
      filename: string;
    }[] = [];

    // Process data rows (skip header row)
    for (let i = headerRowIndex + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!Array.isArray(row) || row.length === 0) continue;

      const country = String(row[countryIndex] || "").trim();
      const iataCode = String(row[iataIndex] || "").trim();
      const low = String(row[lowIndex] || "").trim();
      const high = String(row[highIndex] || "").trim();
      const city = cityIndex !== -1 ? String(row[cityIndex] || "").trim() : null;

      // Skip empty rows
      if (!country && !iataCode && !low && !high) continue;

      // Validate required fields
      if (!country || !iataCode || !low || !high) {
        console.log(`⚠️ Skipping row ${i + 1}: Missing required fields`, { country, iataCode, low, high });
        continue;
      }

      parsedAreas.push({
        company,
        country,
        iataCode,
        low,
        high,
        city: city && city !== "" ? city : null,
        filename,
      });
    }

    if (parsedAreas.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid remote area data found in Excel file.",
        },
        { status: 400 }
      );
    }

    // Delete existing remote areas for this company
    await prisma.remoteArea.deleteMany({
      where: {
        company: company,
      },
    });

    // Create new remote areas
    await prisma.remoteArea.createMany({
      data: parsedAreas,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${parsedAreas.length} remote area entries.`,
      count: parsedAreas.length,
      filename,
    });
  } catch (error: any) {
    console.error("Error processing remote area file:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to process file",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");

    const where = company ? { company: company } : {};

    const remoteAreas = await prisma.remoteArea.findMany({
      where,
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: remoteAreas,
    });
  } catch (error: any) {
    console.error("Error fetching remote areas:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to fetch remote areas",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const company = searchParams.get("company");

    const where = company ? { company: company } : {};

    await prisma.remoteArea.deleteMany({
      where,
    });

    const message = company
      ? `Remote area data for "${company}" has been deleted successfully.`
      : "All remote area data has been deleted successfully.";

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error("Error deleting remote areas:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to delete remote areas",
      },
      { status: 500 }
    );
  }
}

