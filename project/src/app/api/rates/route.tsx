import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const vendor = formData.get("vendor") as string;
    const service = formData.get("service") as string;

    if (!file || !vendor || !service) {
      return NextResponse.json(
        { success: false, message: "Missing file, vendor name, or service" },
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

    console.log("📋 Raw Excel data:", raw.slice(0, 10)); // Log first 10 rows for debugging

    // Parse the Excel data to handle the section-based format
    const parsedRates: {
      weight: number;
      vendor: string;
      service: string;
      zone: number;
      price: number;
      docType: string;
    }[] = [];

    let currentDocType = "";
    let currentHeaders: string[] = [];
    let inDataSection = false;

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      
      // Skip empty rows
      if (!row || row.every((cell: any) => cell === null || cell === undefined || cell === "")) {
        continue;
      }

      const firstCell = row[0]?.toString().trim().toLowerCase();
      
      // Check if this is a section header (Document or Non Document)
      if (firstCell === "document" || firstCell === "non document") {
        currentDocType = firstCell === "document" ? "Document" : "Non Document";
        inDataSection = false;
        currentHeaders = [];
        console.log(`📋 Found section: ${currentDocType}`);
        continue;
      }

      // Check if this row contains headers (Weight From, Weight To, Zone 1, etc.)
      if (row.some((cell: any) => 
        typeof cell === "string" && 
        (cell.toLowerCase().includes("weight from") || 
         cell.toLowerCase().includes("zone"))
      )) {
        currentHeaders = row.map((cell: any) => cell?.toString() || "");
        inDataSection = true;
        console.log(`📋 Found headers for ${currentDocType}:`, currentHeaders);
        continue;
      }

      // Process data rows
      if (inDataSection && currentDocType && currentHeaders.length > 0) {
        // Find column indices
        const weightFromIndex = currentHeaders.findIndex((h: string) => 
          h.toLowerCase().includes("weight from")
        );
        const weightToIndex = currentHeaders.findIndex((h: string) => 
          h.toLowerCase().includes("weight to")
        );
        
        // Find zone columns
        const zoneColumns = currentHeaders
          .map((header: string, index: number) => ({ header, index }))
          .filter(({ header }: { header: string }) => 
            header.toLowerCase().includes("zone") && /\d+/.test(header)
          )
          .sort((a: { header: string }, b: { header: string }) => {
            const aNum = parseInt(a.header.match(/\d+/)?.[0] || "0");
            const bNum = parseInt(b.header.match(/\d+/)?.[0] || "0");
            return aNum - bNum;
          });

        if (weightToIndex === -1 || zoneColumns.length === 0) {
          console.log(`⚠️ Skipping row - missing required columns:`, row);
          continue;
        }

        // Parse weight - use Weight To as the representative weight
        const weightTo = parseFloat(row[weightToIndex]);
        if (isNaN(weightTo)) {
          console.log(`⚠️ Invalid weight to: ${row[weightToIndex]}`);
          continue;
        }

        // Process each zone
        for (const { header, index } of zoneColumns) {
          const zoneNum = parseInt(header.match(/\d+/)?.[0] || "0");
          const priceValue = row[index];
          
          if (priceValue === null || priceValue === undefined || priceValue === "") {
            continue;
          }

          // Handle different price formats
          let price: number;
          if (typeof priceValue === "string") {
            price = parseFloat(priceValue.replace(/,/g, ""));
          } else {
            price = parseFloat(priceValue);
          }

          if (isNaN(price)) {
            console.log(`⚠️ Invalid price for zone ${zoneNum}: ${priceValue}`);
            continue;
          }

          parsedRates.push({
            docType: currentDocType,
            weight: weightTo,
            vendor: vendor,
            service: service,
            zone: zoneNum,
            price,
          });
        }
      }
    }

    if (parsedRates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No valid rate data found in Excel file. Please ensure the file contains 'Document' and 'Non Document' sections with proper headers.",
        },
        { status: 400 }
      );
    }

    // Delete existing rates for this vendor-service combination
    await prisma.rate.deleteMany({
      where: {
        vendor: vendor,
        service: service,
      },
    });

    // Create new rates
    await prisma.rate.createMany({
      data: parsedRates,
      skipDuplicates: true,
    });

    // Store filename in database using raw SQL
    try {
      await prisma.$executeRaw`
        INSERT INTO "filename" ("filename", "vendor", "service", "fileType", "uploadedAt")
        VALUES (${file.name}, ${vendor}, ${service}, 'rate', ${new Date()})
        ON CONFLICT ("service", "fileType")
        DO UPDATE SET "filename" = ${file.name}, "uploadedAt" = ${new Date()}
      `;
    } catch (error) {
      console.warn("⚠️ Failed to store filename, but rates were uploaded successfully:", error);
    }

    console.log(`✅ Parsed ${parsedRates.length} rate entries for vendor: ${vendor}, service: ${service}`);
    console.log(`📊 Sample data:`, parsedRates.slice(0, 3));

    return NextResponse.json({
      success: true,
      message: `Rate list uploaded successfully for ${vendor} - ${service}`,
      count: parsedRates.length,
      sampleData: parsedRates.slice(0, 3), // Return sample data for verification
    });
  } catch (error) {
    console.error("❌ Error uploading rate list:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error processing file. Please ensure the Excel file has the correct format with 'Document' and 'Non Document' sections.",
        error: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vendor = searchParams.get("vendor");
  const service = searchParams.get("service");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const skip = (page - 1) * limit;
  const search = searchParams.get("search")?.trim() || "";

  // If only service is provided, search for all vendors with that service
  // If both vendor and service are provided, search for specific combination
  if (!service) {
    return NextResponse.json({
      success: false,
      message: "Service is required",
      data: [],
      total: 0,
    });
  }

  const where: any = {};

  if (vendor) {
    // Search for specific vendor and service combination
    where.vendor = vendor;
    where.service = service;
  } else {
    // Search for all vendors with the specified service
    where.service = service;
  }

  // Search functionality
  if (search) {
    where.OR = [
      { zone: { equals: parseInt(search) || 0 } },
      { weight: { equals: parseFloat(search) || 0 } },
      { price: { equals: parseInt(search) || 0 } },
      { docType: { contains: search, mode: "insensitive" } },
      { vendor: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rates, total] = await Promise.all([
    prisma.rate.findMany({
      skip,
      take: limit,
      where,
      orderBy: [
        { vendor: "asc" },
        { weight: "asc" },
        { zone: "asc" }
      ],
    }),
    prisma.rate.count({ where }),
  ]);

  if (rates.length === 0) {
    return NextResponse.json({
      success: false,
      message: vendor 
        ? `No rates found for vendor: ${vendor} and service: ${service}`
        : `No rates found for service: ${service}`,
      data: [],
      total: 0,
    });
  }

  return NextResponse.json({ 
    success: true, 
    data: rates,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { vendor, service } = body;

    if (!vendor || !service) {
      return NextResponse.json({
        success: false,
        message: "Vendor and service are required for deletion",
      }, { status: 400 });
    }

    // Delete all rates for the specified vendor and service
    const deleteResult = await prisma.rate.deleteMany({
      where: {
        vendor: vendor,
        service: service,
      },
    });

    console.log(`🗑️ Deleted ${deleteResult.count} rates for vendor: ${vendor}, service: ${service}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.count} rates for ${vendor} - ${service}`,
      deletedCount: deleteResult.count,
    });
  } catch (error) {
    console.error("❌ Error deleting rates:", error);
    return NextResponse.json({
      success: false,
      message: "Failed to delete rates",
      error: (error as Error).message,
    }, { status: 500 });
  }
}
