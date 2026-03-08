import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";
import { Country } from "country-state-city";
import { prisma } from "@/lib/prisma";

/** Build a set of uppercase country names for matching DHL-style PDF lines */
const COUNTRY_NAMES_UPPER = new Set(
  Country.getAllCountries().map((c) => c.name.toUpperCase())
);

/** Words that must never be treated as a country (header/definition text) */
const NOT_COUNTRY_WORDS = new Set([
  "LIST", "REMOTE", "AREA", "BY", "COUNTRY", "EFFECTIVE", "DATE", "DEFINED",
  "POST", "CODE", "CODES", "TOWN", "TOWNS", "PICKUP", "DELIVERY", "WOULD",
  "ATTRACT", "SURCHARGE", "REFER", "SERVICE", "GUIDE", "IMPORT", "EXPRESS",
  "SHIPMENTS", "SAME", "DIFFICULT", "SERVE", "CURRENCY", "PLEASE", "THE", "A",
  "AN", "OF", "AND", "OR", "IN", "TO", "FOR", "IS", "AS",
]);

/**
 * Parse DHL-style "Remote Area by Country" text from a PDF into remote area entries.
 * Expects country names (e.g. AFGHANISTAN, ALBANIA) and subsequent tokens as zip codes,
 * ranges (e.g. 1983-1984), or city names.
 */
async function parseDhlStylePdfText(
  buffer: Buffer,
  company: string,
  filename: string
): Promise<
  {
    company: string;
    country: string;
    iataCode: string;
    low: string;
    high: string;
    city: string | null;
    filename: string;
  }[]
> {
  const parser = new PDFParse({ data: buffer, CanvasFactory });
  const result = await parser.getText();
  await parser.destroy();
  let text = result?.text ?? "";
  // Only normalize numeric ranges (e.g. 1983 - 1984) so Canadian "AOB 0A1 - AOB 0A9" is not broken
  text = text.replace(/(\d+)\s*[-–]\s*(\d+)/g, "$1-$2");

  const parsed: {
    company: string;
    country: string;
    iataCode: string;
    low: string;
    high: string;
    city: string | null;
    filename: string;
  }[] = [];

  const skipLine = (line: string) => {
    const lower = line.toLowerCase().trim();
    if (!lower) return true;
    if (lower.includes("remote area by country")) return true;
    if (lower.includes("effective date")) return true;
    if (lower.includes("a remote area is defined")) return true;
    if (lower.includes("please refer to your service guide")) return true;
    if (lower.includes("remote area list")) return true;
    if (lower.includes("surcharge amount in local currency")) return true;
    if (/^(\d{4}\s+)?\d{1,3}$/.test(lower) && lower.length <= 5) return true;
    if (/^remote\s*area\s*list\s*\d*$/i.test(lower)) return true;
    return false;
  };

  /** Tokens that are header/title text and must never be stored as zip or city */
  const NOT_DATA_TOKENS = new Set([
    "REMOTE", "AREA", "LIST", "2025", "OF", "THE", "A", "AN", "ONE", "WOULD",
    "ATTRACT", "SURCHARGE", "REFER", "SERVICE", "GUIDE", "AMOUNT", "LOCAL",
    "CURRENCY", "IN", "AS", "OR", "AND", "TO", "FOR", "FROM", "SAME", "POST",
    "CODES", "TOWNS", "DELIVERY", "PICKUP", "IMPORT", "EXPRESS", "SHIPMENTS",
    "DEFINED", "ABSENCE", "SUBURB", "TOWN", "NAME", "DIFFICULT", "SERVE",
    "FOLLOWING", "PLEASE", "PAGE",
  ]);
  const isHeaderToken = (t: string) =>
    NOT_DATA_TOKENS.has(t.toUpperCase().replace(/[,.]/g, ""));

  const isZipOrRange = (t: string) =>
    /[-–]/.test(t) ||
    /^[\d.]+$/.test(t) ||
    /^[A-Za-z0-9\s]+$/.test(t);

  /** Canadian postcode: first part A1A, second part 1A1 (or 280, 2G0, etc.) */
  const canadianFirst = /^[A-Za-z]\d[A-Za-z]$/;
  const canadianSecond = /^\d[A-Za-z0-9]{2}$/;

  /** Pass 1: merge Canadian postcode halves (AOA + 1A0 -> AOA 1A0). Pass 2: merge X - Y -> X-Y. */
  function preprocessTokens(tokens: string[]): string[] {
    let pass1: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (
        canadianFirst.test(tokens[i]) &&
        i + 1 < tokens.length &&
        canadianSecond.test(tokens[i + 1])
      ) {
        pass1.push(tokens[i] + " " + tokens[i + 1]);
        i += 2;
      } else {
        pass1.push(tokens[i]);
        i += 1;
      }
    }
    const out: string[] = [];
    i = 0;
    while (i < pass1.length) {
      if (
        out.length > 0 &&
        (pass1[i] === "-" || pass1[i] === "–") &&
        i + 1 < pass1.length
      ) {
        const low = out.pop()!;
        out.push(low + "-" + pass1[i + 1]);
        i += 2;
      } else {
        out.push(pass1[i]);
        i += 1;
      }
    }
    return out;
  }

  let currentCountry = "";
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (skipLine(line)) continue;

    let tokens = line.trim().split(/\s+/).filter(Boolean);
    tokens = preprocessTokens(tokens);
    if (tokens.length === 0) continue;

    const first = tokens[0];
    const firstUpper = first.toUpperCase().replace(/[,.]/g, "");
    // Only treat as country if it's a known country name; never use header words like LIST
    if (
      COUNTRY_NAMES_UPPER.has(firstUpper) &&
      !NOT_COUNTRY_WORDS.has(firstUpper)
    ) {
      currentCountry = firstUpper;
      tokens.shift();
    }

    if (!currentCountry) continue;

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];
      if (token === "-" || token === "–") {
        i += 1;
        continue;
      }
      const rangeMatch = token.match(/^(.+?)\s*[-–]\s*(.+)$/);
      if (rangeMatch) {
        const low = rangeMatch[1].trim();
        const high = rangeMatch[2].trim();
        if (
          low &&
          high &&
          !isHeaderToken(low) &&
          !isHeaderToken(high)
        ) {
          parsed.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low,
            high,
            city: null,
            filename,
          });
        }
        i += 1;
      } else if (/^[\d.]+$/.test(token) || /^[A-Za-z0-9\s]+$/.test(token)) {
        if (!isHeaderToken(token)) {
          parsed.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: token,
            high: token,
            city: null,
            filename,
          });
        }
        i += 1;
      } else {
        // City-like token: merge following consecutive non-zip tokens into one city name
        const cityParts: string[] = [token];
        i += 1;
        while (
          i < tokens.length &&
          !isZipOrRange(tokens[i]) &&
          !COUNTRY_NAMES_UPPER.has(tokens[i].toUpperCase())
        ) {
          cityParts.push(tokens[i]);
          i += 1;
        }
        const filtered = cityParts.filter((p) => !isHeaderToken(p));
        const cityName = filtered.join(" ").replace(/[,.]/g, "").trim();
        const looksLikePageNum = /^\d{1,4}$/.test(cityName);
        if (cityName && !looksLikePageNum) {
          parsed.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: "0",
            high: "0",
            city: cityName,
            filename,
          });
        }
      }
    }
  }

  return parsed;
}

type RemoteAreaEntry = {
  company: string;
  country: string;
  iataCode: string;
  low: string;
  high: string;
  city: string | null;
  filename: string;
};

/**
 * Parse DHL-style Excel with multiple sheets.
 * Each column in each sheet is an independent vertical list:
 *   Country name → zips/ranges/cities below it → empty row → next country ...
 * We read column A top-to-bottom, then B, then C, etc., stacking them.
 * Then we do the same for the next sheet and append.
 */
function parseDhlStyleExcelSheets(
  workbook: XLSX.WorkBook,
  company: string,
  filename: string
): RemoteAreaEntry[] {
  const result: RemoteAreaEntry[] = [];

  const isSkipText = (s: string) => {
    const lower = s.toLowerCase();
    return (
      lower.includes("remote area") ||
      lower.includes("effective date") ||
      lower.includes("please refer")
    );
  };

  const isCountryName = (s: string) => {
    const upper = s.toUpperCase().replace(/[,.]/g, "");
    return COUNTRY_NAMES_UPPER.has(upper) && !NOT_COUNTRY_WORDS.has(upper);
  };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!Array.isArray(raw) || raw.length === 0) continue;

    const rowCount = raw.length;
    let maxCols = 0;
    for (const row of raw) {
      if (Array.isArray(row) && row.length > maxCols) maxCols = row.length;
    }

    for (let col = 0; col < maxCols; col++) {
      let currentCountry = "";

      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        const row = raw[rowIdx];
        if (!Array.isArray(row)) continue;

        const rawCell = row[col];
        if (rawCell === undefined || rawCell === null || rawCell === "") continue;

        const cellValue = String(rawCell).trim();
        if (!cellValue) continue;
        if (isSkipText(cellValue)) continue;

        if (isCountryName(cellValue)) {
          currentCountry = cellValue.toUpperCase().replace(/[,.]/g, "");
          continue;
        }

        if (!currentCountry) continue;

        const rangeMatch = cellValue.match(
          /^([A-Za-z0-9.\s]+?)\s*[-–]\s*([A-Za-z0-9.\s]+)$/
        );

        if (rangeMatch) {
          result.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: rangeMatch[1].trim(),
            high: rangeMatch[2].trim(),
            city: null,
            filename,
          });
        } else if (typeof rawCell === "number" || /^[\d.]+$/.test(cellValue)) {
          result.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: cellValue,
            high: cellValue,
            city: null,
            filename,
          });
        } else if (/^[A-Za-z0-9\s]+$/.test(cellValue)) {
          result.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: cellValue,
            high: cellValue,
            city: null,
            filename,
          });
        } else {
          result.push({
            company,
            country: currentCountry,
            iataCode: currentCountry,
            low: "0",
            high: "0",
            city: cellValue,
            filename,
          });
        }
      }
    }
  }

  return result;
}

// Extract company name from filename
function extractCompanyName(filename: string): string {
  // Remove file extension (Excel and PDF)
  let nameWithoutExt = filename.replace(/\.(xlsx|xls|pdf)$/i, "");
  
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
    nameWithoutExt = filename.replace(/\.(xlsx|xls|pdf)$/i, "");
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

    const isPdf =
      file.type === "application/pdf" ||
      /\.pdf$/i.test(filename);
    const isExcel =
      [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ].includes(file.type) || /\.(xlsx|xls)$/i.test(filename);

    if (!isPdf && !isExcel) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid file type. Please upload an Excel (.xlsx, .xls) or PDF file.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedAreas: {
      company: string;
      country: string;
      iataCode: string;
      low: string;
      high: string;
      city: string | null;
      filename: string;
    }[] = [];

    if (isPdf) {
      parsedAreas = await parseDhlStylePdfText(buffer, company, filename);
    } else {
      const workbook = XLSX.read(buffer, { type: "buffer" });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

      // Find header row (usually first row, but skip empty rows)
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, raw.length); i++) {
        const row = raw[i];
        if (Array.isArray(row) && row.length > 0) {
          const firstCell = String(row[0] || "").toLowerCase().trim();
          if (
            firstCell.includes("country") ||
            firstCell.includes("iata") ||
            firstCell === "country"
          ) {
            headerRowIndex = i;
            break;
          }
        }
      }

      const headerRow = raw[headerRowIndex] || [];

      // Find column indices
      const getColumnIndex = (header: string, alternatives: string[] = []) => {
        const searchTerms = [header, ...alternatives].map((h) => h.toLowerCase());
        for (let i = 0; i < headerRow.length; i++) {
          const cell = String(headerRow[i] || "").toLowerCase().trim();
          if (searchTerms.some((term) => cell.includes(term) || cell === term)) {
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

      // ── Detect format: standard (Country+IATA) vs DHL-style (Country + zip columns) ──
      const isStandardFormat = countryIndex !== -1 && iataIndex !== -1;

      if (isStandardFormat) {
      // ────── STANDARD FORMAT (Country, IATA Code, Low, High, City) ──────
      const hasLowHigh = lowIndex !== -1 && highIndex !== -1;
      const hasCity = cityIndex !== -1;

      for (let i = headerRowIndex + 1; i < raw.length; i++) {
        const row = raw[i];
        if (!Array.isArray(row) || row.length === 0) continue;

        const country = String(row[countryIndex] || "").trim();
        const iataCode = String(row[iataIndex] || "").trim();
        const low = hasLowHigh ? String(row[lowIndex] || "").trim() : "";
        const high = hasLowHigh ? String(row[highIndex] || "").trim() : "";
        const city = hasCity ? String(row[cityIndex] || "").trim() : null;

        if (!country && !iataCode && !low && !high && !city) continue;
        if (!country || !iataCode) continue;

        const hasLowHighData = hasLowHigh && low !== "" && high !== "";
        const hasCityData = city && city !== "" && city.toLowerCase() !== "null";
        if (!hasLowHighData && !hasCityData) continue;

        parsedAreas.push({
          company,
          country,
          iataCode,
          low: hasLowHighData ? low : "0",
          high: hasLowHighData ? high : "0",
          city: hasCityData ? city : null,
          filename,
        });
      }
    } else {
      // ────── DHL-STYLE FORMAT (multi-sheet Excel: Column A = country or city, B–J = zips/ranges) ──────
      const sheetAreas = parseDhlStyleExcelSheets(workbook, company, filename);
      parsedAreas.push(...sheetAreas);
    }
    }

    if (parsedAreas.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No valid remote area data found in file. For PDFs, use a DHL-style list (country names with zip codes or city names).",
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

