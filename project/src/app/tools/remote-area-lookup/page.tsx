"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Search, MapPin } from "lucide-react";
import { Country } from "country-state-city";

export default function RemoteAreaLookupPage() {
  const countries = Country.getAllCountries();

  const [country, setCountry] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [searchType, setSearchType] = useState<"zip" | "city">("zip");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<{
    isRemote: boolean;
    companies?: Array<{ company: string; area: any }>;
  } | null>(null);

  const handleSearch = async () => {
    if (!country) return;
    if (searchType === "zip" && !zipCode.trim()) return;
    if (searchType === "city" && !city.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      const response = await fetch("/api/remote-areas");
      const data = await response.json();

      if (data.success && data.data) {
        const searchValue = searchType === "zip" ? zipCode.trim() : city.trim().toLowerCase();
        const selectedCountry = countries.find((c) => c.isoCode === country);
        const searchCountryName = selectedCountry?.name || country;
        const searchCountryCode = country;

        let matchingAreas = data.data.filter((area: any) => {
          const areaCountry = (area.country?.toLowerCase() || "").trim();
          const areaIataCode = (area.iataCode?.toLowerCase() || "").trim();
          const codeLow = searchCountryCode.toLowerCase();
          const nameLow = searchCountryName.toLowerCase();
          return (
            areaCountry === codeLow ||
            areaCountry === nameLow ||
            areaIataCode === codeLow ||
            areaCountry.includes(nameLow) ||
            nameLow.includes(areaCountry)
          );
        });

        if (matchingAreas.length === 0) {
          matchingAreas = data.data.filter(
            (area: any) =>
              (area.iataCode?.toLowerCase() || "").trim() === searchCountryCode.toLowerCase()
          );
        }

        const matchedAreas: Array<{ company: string; area: any }> = [];

        if (searchType === "zip") {
          const zipNumber = parseFloat(searchValue);
          if (!isNaN(zipNumber)) {
            const rangeMatches = matchingAreas.filter((area: any) => {
              const low = parseFloat(String(area.low || "").trim());
              const high = parseFloat(String(area.high || "").trim());
              return !isNaN(low) && !isNaN(high) && zipNumber >= low && zipNumber <= high;
            });
            matchedAreas.push(...rangeMatches.map((area: any) => ({ company: area.company, area })));

            const stringMatches = matchingAreas.filter((area: any) => {
              const lowStr = String(area.low || "").trim();
              const highStr = String(area.high || "").trim();
              return (
                (lowStr.includes(searchValue) || highStr.includes(searchValue)) &&
                !matchedAreas.some((m) => m.company === area.company && m.area.id === area.id)
              );
            });
            matchedAreas.push(...stringMatches.map((area: any) => ({ company: area.company, area })));
          } else {
            const stringMatches = matchingAreas.filter((area: any) => {
              const lowStr = String(area.low || "").trim();
              const highStr = String(area.high || "").trim();
              return lowStr.includes(searchValue) || highStr.includes(searchValue);
            });
            matchedAreas.push(...stringMatches.map((area: any) => ({ company: area.company, area })));
          }
        } else {
          const cityMatches = matchingAreas.filter((area: any) => {
            const areaCity = (area.city || "").toLowerCase().trim();
            return areaCity === searchValue;
          });
          matchedAreas.push(...cityMatches.map((area: any) => ({ company: area.company, area })));
        }

        setResult({ isRemote: matchedAreas.length > 0, companies: matchedAreas });
      }
    } catch {
      // silently fail
    } finally {
      setIsSearching(false);
    }
  };

  const handleReset = () => {
    setCountry("");
    setZipCode("");
    setCity("");
    setSearchType("zip");
    setResult(null);
  };

  const canSearch =
    country &&
    (searchType === "zip" ? zipCode.trim() : city.trim());

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug">
              <span className="bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                Remote area
              </span>
              <br />
              <span className="text-slate-800">lookup</span>
            </h1>
            <p className="text-slate-500 mt-3 text-base sm:text-lg max-w-lg mx-auto">
              Check if a location is a remote area by selecting a country and entering either a zip code or city name.
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl bg-slate-100 p-5 sm:p-7 space-y-5">
            {/* Country */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-slate-600">
                Country <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <select
                  value={country}
                  onChange={(e) => { setCountry(e.target.value); setResult(null); }}
                  className="w-full h-[46px] bg-white border border-slate-200 rounded-xl text-sm px-4 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <option value="">Select a country</option>
                  {countries.map((c) => (
                    <option key={c.isoCode} value={c.isoCode}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Search By */}
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-wide text-slate-600">Search by</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="zip"
                    checked={searchType === "zip"}
                    onChange={() => { setSearchType("zip"); setCity(""); setResult(null); }}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-400"
                  />
                  <span className="text-sm text-slate-700">Zip code</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="searchType"
                    value="city"
                    checked={searchType === "city"}
                    onChange={() => { setSearchType("city"); setZipCode(""); setResult(null); }}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-400"
                  />
                  <span className="text-sm text-slate-700">City</span>
                </label>
              </div>
            </div>

            {/* Zip code (when Search by Zip) */}
            {searchType === "zip" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">
                  Zip code <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Enter zip code"
                  value={zipCode}
                  onChange={(e) => { setZipCode(e.target.value); setResult(null); }}
                  className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}

            {/* City (when Search by City) */}
            {searchType === "city" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="Enter city name"
                  value={city}
                  onChange={(e) => { setCity(e.target.value); setResult(null); }}
                  className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                />
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSearch}
                disabled={isSearching || !canSearch}
                className="flex-1 h-[46px] rounded-xl bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-sm"
              >
                {isSearching ? (
                  "Searching..."
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="h-[46px] rounded-xl border-slate-300 text-slate-600 text-sm px-6"
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6"
              >
                {result.isRemote && result.companies && result.companies.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-center text-sm font-semibold text-slate-500">
                      Found {result.companies.length} remote area match{result.companies.length > 1 ? "es" : ""}
                    </p>
                    {result.companies.map((match, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-white border-2 border-amber-300 p-5 flex items-start gap-4"
                      >
                        <CheckCircle2 className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-slate-800">
                            {match.company}
                          </p>
                          <p className="text-sm text-slate-500">
                            This is a <span className="font-semibold text-amber-600">remote area</span>
                          </p>
                          {match.area?.low && match.area?.high && (
                            <p className="text-xs text-slate-400">
                              Zip range: {match.area.low} &ndash; {match.area.high}
                            </p>
                          )}
                          {match.area?.city && (
                            <p className="text-xs text-slate-400">City: {match.area.city}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-white border-2 border-emerald-300 p-6 text-center">
                    <XCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-800">Not a remote area</p>
                    <p className="text-sm text-slate-500 mt-1">
                      The location you searched for is not listed as a remote area in our database.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
