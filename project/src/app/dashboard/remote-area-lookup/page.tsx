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

        console.log("🎯 Final result:", { found, matchedAreas, count: matchedAreas.length });

        setResult({
          isRemote: found,
          companies: matchedAreas,
        });

        if (found) {
          const companyNames = matchedAreas.map(m => m.company).join(", ");
          toast.success(`Found ${matchedAreas.length} remote area(s) for: ${companyNames}`);
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
              Remote Area Lookup
            </h1>

            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Check if a location is a remote area by selecting a country and entering either a zip code or city name.
            </p>

            {/* Search Form */}
            <div className="space-y-4">
              {/* Country Selection */}
              <div className="space-y-2">
                <Label htmlFor="country" className="text-sm font-medium">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="country" className="w-full">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.isoCode} value={c.isoCode}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Type Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Search By</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchType"
                      value="zip"
                      checked={searchType === "zip"}
                      onChange={(e) => {
                        setSearchType(e.target.value as "zip");
                        setCity("");
                        setResult(null);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Zip Code</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="searchType"
                      value="city"
                      checked={searchType === "city"}
                      onChange={(e) => {
                        setSearchType(e.target.value as "city");
                        setZipCode("");
                        setResult(null);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">City</span>
                  </label>
                </div>
              </div>

              {/* Zip Code Input */}
              {searchType === "zip" && (
                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="text-sm font-medium">
                    Zip Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zipCode"
                    type="text"
                    placeholder="Enter zip code"
                    value={zipCode}
                    onChange={(e) => {
                      setZipCode(e.target.value);
                      setResult(null);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {/* City Input */}
              {searchType === "city" && (
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    type="text"
                    placeholder="Enter city name"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setResult(null);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isSearching ? "Searching..." : "Search"}
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  Reset
                </Button>
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
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-8 h-8 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-1" />
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
                          Found {result.companies.length} remote area match(es):
                        </p>
                        {result.companies.map((match, index) => (
                          <div key={index} className="bg-white dark:bg-gray-900 p-4 rounded-lg border border-green-300 dark:border-green-700">
                            <p className="text-sm text-green-800 dark:text-green-200 font-medium mb-2">
                              <strong>Company {index + 1}:</strong> {match.company}
                            </p>
                            {match.area && (
                              <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                                {match.area.low && match.area.high && (
                                  <p>
                                    <strong>Zip Code Range:</strong> {match.area.low} - {match.area.high}
                                  </p>
                                )}
                                {match.area.city && (
                                  <p>
                                    <strong>City:</strong> {match.area.city}
                                  </p>
                                )}
                                {match.area.iataCode && (
                                  <p>
                                    <strong>IATA Code:</strong> {match.area.iataCode}
                                  </p>
                                )}
                                {match.area.country && (
                                  <p>
                                    <strong>Country:</strong> {match.area.country}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
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

