import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Country } from "country-state-city";

// Local helper to determine remote-area status using pre-fetched remote areas
function computeRemoteStatus(
  remoteAreas: any[],
  country: string,
  city?: string | null,
  zip?: string | null
): { isRemote: boolean; companies: string[] } {
  if (!country) return { isRemote: false, companies: [] };

  const selectedCountry = Country.getCountryByCode(country);
  const searchCountryName = selectedCountry?.name || country;
  const searchCountryCode = country.toLowerCase();

  // Filter by country - check country code, country name, and IATA code
  let matchingAreas = remoteAreas.filter((area: any) => {
    const areaCountry = (area.country?.toLowerCase() || "").trim();
    const areaIataCode = (area.iataCode?.toLowerCase() || "").trim();
    const searchCountryNameLower = searchCountryName.toLowerCase();

    return (
      areaCountry === searchCountryCode ||
      areaCountry === searchCountryNameLower ||
      areaIataCode === searchCountryCode ||
      areaCountry.includes(searchCountryNameLower) ||
      searchCountryNameLower.includes(areaCountry)
    );
  });

  // If no matches found by country name/code, try matching by IATA code only
  if (matchingAreas.length === 0) {
    matchingAreas = remoteAreas.filter((area: any) => {
      const areaIataCode = (area.iataCode?.toLowerCase() || "").trim();
      return areaIataCode === searchCountryCode;
    });
  }

  if (matchingAreas.length === 0) return { isRemote: false, companies: [] };

  const matchedCompanies = new Set<string>();

  // Check by zip code if provided
  if (zip && zip.trim()) {
    const zipValue = zip.trim();
    const zipNumber = parseFloat(zipValue);

    if (!isNaN(zipNumber)) {
      // Check if zip code falls within any range
      const rangeMatches = matchingAreas.filter((area: any) => {
        const low = parseFloat(String(area.low || "").trim());
        const high = parseFloat(String(area.high || "").trim());
        return !isNaN(low) && !isNaN(high) && zipNumber >= low && zipNumber <= high;
      });
      rangeMatches.forEach((area: any) => {
        if (area.company) matchedCompanies.add(area.company);
      });

      // Also check for string matches
      const stringMatches = matchingAreas.filter((area: any) => {
        const lowStr = String(area.low || "").trim();
        const highStr = String(area.high || "").trim();
        return lowStr.includes(zipValue) || highStr.includes(zipValue);
      });
      stringMatches.forEach((area: any) => {
        if (area.company) matchedCompanies.add(area.company);
      });
    } else {
      // String match for zip
      const stringMatches = matchingAreas.filter((area: any) => {
        const lowStr = String(area.low || "").trim();
        const highStr = String(area.high || "").trim();
        return lowStr.includes(zipValue) || highStr.includes(zipValue);
      });
      stringMatches.forEach((area: any) => {
        if (area.company) matchedCompanies.add(area.company);
      });
    }
  }

  // Check by city if provided
  if (city && city.trim()) {
    const cityValue = city.trim().toLowerCase();
    const cityMatches = matchingAreas.filter((area: any) => {
      const areaCity = area.city?.toLowerCase();
      return areaCity === cityValue;
    });
    cityMatches.forEach((area: any) => {
      if (area.company) matchedCompanies.add(area.company);
    });
  }

  const companies = Array.from(matchedCompanies);
  return { isRemote: companies.length > 0, companies };
}

export async function POST() {
  try {
    // Fetch all remote areas once for efficiency
    const remoteAreas = await prisma.remoteArea.findMany({
      orderBy: { uploadedAt: "desc" },
    });

    // Fetch all recipients
    const recipients = await prisma.recipients.findMany();

    let updatedCount = 0;
    let matchedCount = 0;

    for (const recipient of recipients) {
      const result = computeRemoteStatus(
        remoteAreas,
        recipient.Country,
        recipient.City,
        recipient.Zip
      );

      const companiesJson =
        result.companies.length > 0 ? JSON.stringify(result.companies) : null;

      if (result.isRemote) matchedCount += 1;

      // Only update when there is a change to avoid unnecessary writes
      if (
        recipient.isRemoteArea !== result.isRemote ||
        recipient.remoteAreaCompanies !== companiesJson
      ) {
        await prisma.recipients.update({
          where: { id: recipient.id },
          data: {
            isRemoteArea: result.isRemote,
            remoteAreaCompanies: companiesJson,
          },
        });
        updatedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      totalRecipients: recipients.length,
      updated: updatedCount,
      remoteAreasCount: remoteAreas.length,
      matchedRecipients: matchedCount,
    });
  } catch (error) {
    console.error("Error recalculating remote areas:", error);
    return NextResponse.json(
      { success: false, message: "Failed to recalculate remote areas" },
      { status: 500 }
    );
  }
}

