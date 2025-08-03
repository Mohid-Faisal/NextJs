import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma"; // adjust import path based on your setup
import { Country } from "country-state-city";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const service = formData.get("service") as string;
    const filename = file.name;

    if (!file || !service) {
      return NextResponse.json(
        { success: false, message: "Missing file or service" },
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
    const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    const headerRow = raw[0]; // Zone names
    const parsedZones: {
      code: string;
      country: string;
      zone: string;
      service: string;
      phoneCode: string;
    }[] = [];
    const allCountries = Country.getAllCountries();
    
    // Log all countries with their ISO codes
    // console.log("=== ALL COUNTRIES WITH ISO CODES ===");
    // allCountries.forEach(country => {
    //   console.log(`${country.name}: ${country.isoCode} (Phone: +${country.phonecode})`);
    // });
    // console.log("=== END COUNTRIES LIST ===");
    // const allIsoCodes = allCountries.map((c) => c.isoCode);
    // console.log("allCountries", allCountries);
    // console.log("allIsoCodes", allIsoCodes);

    for (let col = 0; col < headerRow.length; col++) {
      const zoneName = headerRow[col]?.toString().trim();
      if (!zoneName) continue;

      for (let row = 1; row < raw.length; row++) {
        const country = raw[row]?.[col]?.toString().trim();
        if (!country) continue;

        const matchedCountry = allCountries.find(
          (c) => c.name.toLowerCase() === country.toLowerCase()
        );

        // // Log country matching process
        // if (matchedCountry) {
        //   console.log(`✅ Matched: "${country}" -> ${matchedCountry.name} (${matchedCountry.isoCode}, +${matchedCountry.phonecode})`);
        // } else {
        //   console.log(`❌ No match found for: "${country}"`);
        // }

        // Try to lookup country code from `country-to-iso` (optional improvement)
        parsedZones.push({
          code: matchedCountry?.isoCode || "", // optional: lookup country code here if needed
          country,
          zone: zoneName,
          service: service.toLowerCase(),
          phoneCode: matchedCountry?.phonecode || "",
        });
      }
    }

    // Optional: delete existing data for the company
    await prisma.zone.deleteMany({
      where: { service: service.toLowerCase() },
    });

    await prisma.zone.createMany({
      data: parsedZones,
      skipDuplicates: true,
    });

    // Track upload time for this service using raw SQL
    const uploadTime = new Date();
    try {
      await prisma.$executeRaw`
        INSERT INTO "ZoneUpload" ("service", "uploadedAt") 
        VALUES (${service.toLowerCase()}, ${uploadTime})
        ON CONFLICT ("service") 
        DO UPDATE SET "uploadedAt" = ${uploadTime}
      `;
    } catch (error) {
      console.log("Upload time tracking failed, but zones were saved:", error);
    }

    // Store filename information using raw SQL
    try {
      await prisma.$executeRaw`
        INSERT INTO "filename" ("filename", "vendor", "service", "fileType", "uploadedAt")
        VALUES (${filename}, '', ${service.toLowerCase()}, 'zone', ${uploadTime})
        ON CONFLICT ("service", "fileType")
        DO UPDATE SET "filename" = ${filename}, "uploadedAt" = ${uploadTime}
      `;
    } catch (error) {
      console.log("Filename tracking failed, but zones were saved:", error);
    }

    return NextResponse.json({
      success: true,
      message: `Zone list uploaded successfully for ${service}`,
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
  const service = searchParams.get("service");

  if (!service) {
    return NextResponse.json({
      success: false,
      message: "Service not specified",
      data: [],
    });
  }

  // Get zones with vendor information from rates table
  const zonesWithVendors = await prisma.zone.findMany({
    where: {
      service: service.toLowerCase(),
    },
  });

  // Get unique vendors for this service from rates table
  const vendorsForService = await prisma.rate.findMany({
    where: {
      service: service.toLowerCase(),
    },
    select: {
      vendor: true,
    },
    distinct: ['vendor'],
  });

  // Get upload time and filename for this service
  let uploadTime = null;
  let filename = null;
  try {
    const uploadResult = await prisma.$queryRaw`
      SELECT "uploadedAt" FROM "ZoneUpload" WHERE "service" = ${service.toLowerCase()}
    `;
    if (uploadResult && Array.isArray(uploadResult) && uploadResult.length > 0) {
      uploadTime = uploadResult[0].uploadedAt;
    }
  } catch (error) {
    console.log("Failed to fetch upload time:", error);
  }
  // console.log("uploadTime", uploadTime);

  try {
    const filenameResult = await prisma.$queryRaw`
      SELECT "filename", "uploadedAt" FROM "filename" WHERE "service" = ${service.toLowerCase()} AND "fileType" = 'zone'
    `;
    if (filenameResult && Array.isArray(filenameResult) && filenameResult.length > 0) {
      filename = filenameResult[0].filename;
      // Use filename upload time if available, otherwise use zone upload time
      if (filenameResult[0].uploadedAt) {
        uploadTime = filenameResult[0].uploadedAt;
      }
    }
  } catch (error) {
    console.log("Failed to fetch filename:", error);
  }

  // Combine zone data with vendor information
  const zonesWithVendorInfo = zonesWithVendors.map(zone => ({
    ...zone,
    vendors: vendorsForService.map(v => v.vendor),
    uploadedAt: uploadTime,
    filename: filename
  }));

  if (zonesWithVendorInfo.length === 0) {
    return NextResponse.json({
      success: false,
      message: "No zones found for service",
      data: [],
    });
  }

  return NextResponse.json({ 
    success: true, 
    data: zonesWithVendorInfo,
    vendors: vendorsForService.map(v => v.vendor)
  });
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service");

    if (!service) {
      return NextResponse.json({
        success: false,
        message: "Service not specified",
      }, { status: 400 });
    }

    console.log(`🗑️ Deleting all zone data for service: ${service}`);

    // Delete all zones for the service
    const deletedZones = await prisma.zone.deleteMany({
      where: {
        service: service.toLowerCase(),
      },
    });

    // Delete upload time record
    try {
      await prisma.$executeRaw`
        DELETE FROM "ZoneUpload" WHERE "service" = ${service.toLowerCase()}
      `;
    } catch (error) {
      console.log("Failed to delete upload time record:", error);
    }

    // Delete filename record
    try {
      await prisma.$executeRaw`
        DELETE FROM "filename" WHERE "service" = ${service.toLowerCase()} AND "fileType" = 'zone'
      `;
    } catch (error) {
      console.log("Failed to delete filename record:", error);
    }

    console.log(`✅ Deleted ${deletedZones.count} zones for service: ${service}`);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all zone data for ${service}`,
      deletedCount: deletedZones.count,
    });

  } catch (error) {
    console.error("❌ Error deleting zone data:", error);
    return NextResponse.json({
      success: false,
      message: "Error deleting zone data",
      error: (error as Error).message,
    }, { status: 500 });
  }
}
