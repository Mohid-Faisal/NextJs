import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma"; // adjust import path based on your setup
import { Country } from "country-state-city";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const service = formData.get("service") as string;

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
    }[] = [];
    const allCountries = Country.getAllCountries();

    for (let col = 0; col < headerRow.length; col++) {
      const zoneName = headerRow[col]?.toString().trim();
      if (!zoneName) continue;

      for (let row = 1; row < raw.length; row++) {
        const country = raw[row]?.[col]?.toString().trim();
        if (!country) continue;

        const matchedCountry = allCountries.find(
          (c) => c.name.toLowerCase() === country.toLowerCase()
        );

        // Try to lookup country code from `country-to-iso` (optional improvement)
        parsedZones.push({
          code: matchedCountry?.isoCode || "", // optional: lookup country code here if needed
          country,
          zone: zoneName,
          service: service.toLowerCase(),
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

  const zones = await prisma.zone.findMany({
    where: {
      service: service.toLowerCase(),
    },
  });

  if (zones.length === 0) {
    return NextResponse.json({
      success: false,
      message: "No zones found for service",
      data: [],
    });
  }

  return NextResponse.json({ success: true, data: zones });
}
