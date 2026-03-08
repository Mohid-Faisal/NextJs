"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Country } from "country-state-city";

function FlagIcon({ country, className }: { country: { isoCode?: string; name?: string }; className?: string }) {
  if (!country?.isoCode) return null;
  const code = country.isoCode.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/w40/${code}.png`}
      srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
      alt={country.name || code}
      className={className ?? "w-5 h-3.5 object-cover rounded-sm inline-block"}
      loading="lazy"
    />
  );
}

const RemoteAreaLookupPage = () => {
  const router = useRouter();
  const [country, setCountry] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [searchType, setSearchType] = useState<"zip" | "city">("zip");
  const [result, setResult] = useState<{
    isRemote: boolean;
    companies?: Array<{ company: string; area: any }>;
  } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Get all countries
  const countries = Country.getAllCountries();

  // Handle search
  const handleSearch = async () => {
    if (!country) {
      toast.error("Please select a country");
      return;
    }

    if (searchType === "zip" && !zipCode.trim()) {
      toast.error("Please enter a zip code");
      return;
    }

    if (searchType === "city" && !city.trim()) {
      toast.error("Please enter a city name");
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      console.log("🔍 Starting search...");
      console.log("Search params:", { country, searchType, zipCode, city });
      
      const response = await fetch("/api/remote-areas");
      const data = await response.json();

      console.log("📦 API Response:", data);
      console.log("Total areas in database:", data.data?.length || 0);

      if (data.success && data.data) {
        const searchValue = searchType === "zip" ? zipCode.trim() : city.trim().toLowerCase();
        const searchCountryCode = country;
        
        // Get country name from code
        const selectedCountry = countries.find(c => c.isoCode === searchCountryCode);
        const searchCountryName = selectedCountry?.name || searchCountryCode;

        console.log("🔎 Search values:", { 
          searchValue, 
          searchCountryCode, 
          searchCountryName,
          selectedCountry 
        });

        // Filter by country - check country code, country name, and IATA code
        let matchingAreas = data.data.filter((area: any) => {
          const areaCountry = (area.country?.toLowerCase() || '').trim();
          const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
          const searchCountryCodeLower = searchCountryCode.toLowerCase();
          const searchCountryNameLower = searchCountryName.toLowerCase();
          
          // Check multiple matching strategies
          const matches = 
            areaCountry === searchCountryCodeLower ||
            areaCountry === searchCountryNameLower ||
            areaIataCode === searchCountryCodeLower ||
            // Also check if country name contains the search term (for variations like "Bahamas" vs "The Bahamas")
            areaCountry.includes(searchCountryNameLower) ||
            searchCountryNameLower.includes(areaCountry);
          
          if (!matches) {
            console.log(`❌ Country mismatch: area.country="${area.country}" area.iataCode="${area.iataCode}" vs code="${searchCountryCode}" vs name="${searchCountryName}"`);
          } else {
            console.log(`✅ Country match: area.country="${area.country}" area.iataCode="${area.iataCode}" matches "${searchCountryName}"`);
          }
          return matches;
        });
        
        // If no matches found by country name/code, try matching by IATA code only
        if (matchingAreas.length === 0) {
          console.log("🔍 No matches by country name/code, trying IATA code match...");
          matchingAreas = data.data.filter((area: any) => {
            const areaIataCode = (area.iataCode?.toLowerCase() || '').trim();
            const matches = areaIataCode === searchCountryCode.toLowerCase();
            
            if (matches) {
              console.log(`✅ IATA code match: area.iataCode="${area.iataCode}" matches country code "${searchCountryCode}"`);
            }
            return matches;
          });
        }

        console.log(`🌍 Areas matching country "${searchCountryName}" (code: ${searchCountryCode}):`, matchingAreas.length);
        console.log("Matching areas:", matchingAreas);

        let found = false;
        let matchedAreas: Array<{ company: string; area: any }> = [];

        if (searchType === "zip") {
          console.log("📮 Searching by ZIP CODE:", searchValue);
          
          // Check if zip code falls within any range
          const zipNumber = parseFloat(searchValue);
          console.log("Parsed zip number:", zipNumber, "isNaN:", isNaN(zipNumber));
          
          if (!isNaN(zipNumber)) {
            console.log("🔢 Checking numeric range matches...");
            
            // Find all areas where zip code falls within the range
            const rangeMatches = matchingAreas.filter((area: any) => {
              const low = parseFloat(String(area.low || '').trim());
              const high = parseFloat(String(area.high || '').trim());
              
              console.log(`  Checking area:`, {
                company: area.company,
                country: area.country,
                low: area.low,
                high: area.high,
                parsedLow: low,
                parsedHigh: high,
                zipNumber,
                inRange: !isNaN(low) && !isNaN(high) && zipNumber >= low && zipNumber <= high
              });
              
              // Check if both low and high are valid numbers
              if (!isNaN(low) && !isNaN(high)) {
                // Check if zip code falls within the range (inclusive)
                const inRange = zipNumber >= low && zipNumber <= high;
                if (inRange) {
                  console.log(`  ✅ MATCH FOUND! Zip ${zipNumber} is between ${low} and ${high} for ${area.company}`);
                }
                return inRange;
              }
              return false;
            });
            
            console.log("Range match results:", rangeMatches);
            
            // Add range matches to results
            matchedAreas.push(...rangeMatches.map((area: any) => ({
              company: area.company,
              area: area
            })));
            
            // Also check for string matches in low/high fields (for non-numeric matches)
            const stringMatches = matchingAreas.filter((area: any) => {
              const lowStr = String(area.low || '').trim();
              const highStr = String(area.high || '').trim();
              const lowMatch = lowStr.includes(searchValue);
              const highMatch = highStr.includes(searchValue);
              
              if (lowMatch || highMatch) {
                console.log(`  ✅ String match found:`, {
                  company: area.company,
                  low: lowStr,
                  high: highStr,
                  searchValue
                });
              }
              
              // Only add if not already in matchedAreas
              return (lowMatch || highMatch) && !matchedAreas.some(m => m.company === area.company && m.area.id === area.id);
            });
            
            matchedAreas.push(...stringMatches.map((area: any) => ({
              company: area.company,
              area: area
            })));
            
            found = matchedAreas.length > 0;
          } else {
            console.log("🔤 Not a valid number, checking string matches...");
            // If not a valid number, check string matches
            const stringMatches = matchingAreas.filter((area: any) => {
              const lowStr = String(area.low || '').trim();
              const highStr = String(area.high || '').trim();
              const lowMatch = lowStr.includes(searchValue);
              const highMatch = highStr.includes(searchValue);
              
              if (lowMatch || highMatch) {
                console.log(`  ✅ String match found:`, {
                  company: area.company,
                  low: lowStr,
                  high: highStr,
                  searchValue
                });
              }
              
              return lowMatch || highMatch;
            });
            
            matchedAreas.push(...stringMatches.map((area: any) => ({
              company: area.company,
              area: area
            })));
            found = matchedAreas.length > 0;
          }
        } else {
          console.log("🏙️ Searching by CITY:", searchValue);
          // Search by city - find all matches
          const cityMatches = matchingAreas.filter((area: any) => {
            const areaCity = area.city?.toLowerCase();
            const matches = areaCity === searchValue;
            
            if (matches) {
              console.log(`  ✅ City match found:`, {
                company: area.company,
                city: area.city,
                searchValue
              });
            }
            
            return matches;
          });
          
          matchedAreas.push(...cityMatches.map((area: any) => ({
            company: area.company,
            area: area
          })));
          found = matchedAreas.length > 0;
        }

        // One card per company (DHL, FedEx, UPS) — deduplicate by company
        const byCompany = new Map<string, { company: string; area: any }>();
        for (const m of matchedAreas) {
          const key = (m.company || "").trim().toLowerCase();
          if (key && !byCompany.has(key)) byCompany.set(key, m);
        }
        const uniqueByCompany = Array.from(byCompany.values());

        console.log("🎯 Final result:", { found, matchedAreas, uniqueByCompany, count: uniqueByCompany.length });

        setResult({
          isRemote: uniqueByCompany.length > 0,
          companies: uniqueByCompany,
        });

        if (uniqueByCompany.length > 0) {
          const companyNames = uniqueByCompany.map(m => m.company).join(", ");
          toast.success(`Found ${uniqueByCompany.length} remote area(s) for: ${companyNames}`);
        } else {
          toast.info("Location is not a remote area");
        }
      } else {
        toast.error("Failed to fetch remote area data");
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Failed to search remote area");
    } finally {
      setIsSearching(false);
    }
  };

  // Reset form
  const handleReset = () => {
    setCountry("");
    setZipCode("");
    setCity("");
    setSearchType("zip");
    setResult(null);
  };

  return (
    <div className="w-full min-h-full p-4 sm:p-6 lg:p-8 xl:p-10 bg-white dark:bg-zinc-900">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto"
      >
        {/* Back Button */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>

        <Card className="bg-white dark:bg-gray-900 border shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-6 lg:p-8 space-y-6">
            <h1 className="text-xl sm:text-2xl font-semibold text-primary text-center">
              Remote area lookup
            </h1>

            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Check if a location is a remote area by selecting a country and entering either a zip code or city name.
            </p>

            {/* Search Form - match external tools layout */}
            <div className="space-y-4">
              {/* Row 1: Country (half) | Zip/City tabs (half) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country with flags */}
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-xs font-bold tracking-wide text-slate-600">
                    Country <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={country}
                    onValueChange={(v) => {
                      setCountry(v);
                      setResult(null);
                    }}
                  >
                    <SelectTrigger id="country" className="w-full h-[46px] bg-white border-slate-200 rounded-xl text-sm">
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {countries.map((c) => (
                        <SelectItem key={c.isoCode} value={c.isoCode} className="text-sm">
                          <span className="flex items-center gap-2">
                            <FlagIcon country={c} />
                            <span>{c.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Search by - tab style */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold tracking-wide text-slate-600">Search by</Label>
                  <div className="flex rounded-xl bg-white border border-slate-200 p-1 h-[46px] box-border">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchType("zip");
                        setCity("");
                        setResult(null);
                      }}
                      className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                        searchType === "zip"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Zip code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchType("city");
                        setZipCode("");
                        setResult(null);
                      }}
                      className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                        searchType === "city"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      City
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 2: Input (half) | Search buttons (half) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold tracking-wide text-slate-600">
                    {searchType === "zip" ? "Zip code" : "City"} <span className="text-red-500">*</span>
                  </Label>
                  {searchType === "zip" ? (
                    <Input
                      id="zipCode"
                      type="text"
                      placeholder="Enter zip code"
                      value={zipCode}
                      onChange={(e) => {
                        setZipCode(e.target.value);
                        setResult(null);
                      }}
                      className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                    />
                  ) : (
                    <Input
                      id="city"
                      type="text"
                      placeholder="Enter city name"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        setResult(null);
                      }}
                      className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                    />
                  )}
                </div>
                <div className="space-y-1.5 sm:pt-6">
                  <div className="flex gap-2 h-[46px]">
                    <Button
                      onClick={handleSearch}
                      disabled={isSearching}
                      className="flex-1 h-full rounded-xl bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-sm"
                    >
                      {isSearching ? "Searching..." : <><Search className="w-4 h-4 mr-2 inline" /> Search</>}
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      className="h-full rounded-xl border-slate-300 text-slate-600 text-sm px-4 shrink-0"
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Results */}
            {result !== null && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-6 p-6 rounded-lg border-2 ${
                  result.isRemote
                    ? "bg-green-50 dark:bg-green-950 border-green-500"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                }`}
              >
                <div className="flex items-start gap-4">
                  {result.isRemote ? (
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-8 h-8 text-gray-600 dark:text-gray-400 shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-semibold mb-2 ${
                        result.isRemote
                          ? "text-green-900 dark:text-green-100"
                          : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {result.isRemote
                        ? "This is a Remote Area"
                        : "This is NOT a Remote Area"}
                    </h3>
                    {result.isRemote && result.companies && result.companies.length > 0 && (
                      <div className="space-y-4">
                        <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
                          Found {result.companies.length} remote area match{result.companies.length !== 1 ? "es" : ""}:
                        </p>
                        <div className={`grid grid-cols-1 gap-4 ${result.companies.length === 1 ? "sm:grid-cols-1" : result.companies.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                          {result.companies.map((match, index) => (
                            <div key={index} className="bg-white dark:bg-gray-900 p-4 rounded-xl border-2 border-green-300 dark:border-green-700 flex justify-center">
                              <div className="flex items-start gap-3 text-left">
                                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                <p className="text-sm text-green-800 dark:text-green-200 font-semibold">
                                  {match.company}
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  This is a remote area
                                </p>
                                {match.area && (
                                  <div className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                                    {match.area.low != null && match.area.high != null && (
                                      <p>Zip range: {match.area.low} – {match.area.high}</p>
                                    )}
                                    {match.area.city && <p>City: {match.area.city}</p>}
                                  </div>
                                )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!result.isRemote && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        The location you searched for is not listed as a remote area in our database.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default RemoteAreaLookupPage;

