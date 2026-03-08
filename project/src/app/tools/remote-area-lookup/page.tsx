"use client";

import Link from "next/link";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Search } from "lucide-react";
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

        // One card per company (DHL, FedEx, UPS) — deduplicate by company
        const byCompany = new Map<string, { company: string; area: any }>();
        for (const m of matchedAreas) {
          const key = (m.company || "").trim().toLowerCase();
          if (key && !byCompany.has(key)) byCompany.set(key, m);
        }
        const uniqueByCompany = Array.from(byCompany.values());

        setResult({ isRemote: uniqueByCompany.length > 0, companies: uniqueByCompany });
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
      <div className="w-full max-w-7xl mx-auto flex gap-6">
        <div className="flex-1 min-w-0 flex justify-end">
          <nav className="mb-4 text-sm text-slate-500 text-right shrink-0">
            <Link href="/" className="hover:text-sky-500">
              Home
            </Link>
            <span className="mx-2">›</span>
            <Link href="/tools" className="hover:text-sky-500">
              Tools
            </Link>
            <span className="mx-2">›</span>
            <span className="text-sky-500 font-medium">
              Remote area lookup
            </span>
          </nav>
        </div>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-4xl shrink-0">
          {/* Heading - one line */}
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
              <span className="bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">Remote area</span>{" "}
              <span className="text-slate-800">lookup</span>
            </h1>
            <p className="text-slate-500 mt-3 text-base sm:text-lg max-w-2xl mx-auto">
              Check if a location is a remote area by selecting a country and entering either a zip code or city name.
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl bg-slate-100 p-5 sm:p-7 space-y-4">
            {/* Row 1: Country (half) | Zip/City tabs (half) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Country - half width, same as public rate calc */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">
                  Country <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={country}
                  onValueChange={(v) => {
                    setCountry(v);
                    setResult(null);
                  }}
                >
                  <SelectTrigger className="w-full h-[46px] bg-white border-slate-200 rounded-xl text-sm">
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
                    onClick={() => { setSearchType("zip"); setCity(""); setResult(null); }}
                    className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                      searchType === "zip"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Zip code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSearchType("city"); setZipCode(""); setResult(null); }}
                    className={`flex-1 rounded-lg text-sm font-medium transition-colors ${
                      searchType === "city"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    City
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Input (half) | Search button (half) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold tracking-wide text-slate-600">
                  {searchType === "zip" ? "Zip code" : "City"} <span className="text-red-500">*</span>
                </Label>
                {searchType === "zip" ? (
                  <Input
                    type="text"
                    placeholder="Enter zip code"
                    value={zipCode}
                    onChange={(e) => { setZipCode(e.target.value); setResult(null); }}
                    className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                  />
                ) : (
                  <Input
                    type="text"
                    placeholder="Enter city name"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setResult(null); }}
                    className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
                  />
                )}
              </div>
              <div className="space-y-1.5 sm:pt-6">
                <div className="flex gap-2 h-[46px]">
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || !canSearch}
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
                      Found {result.companies.length} remote area match{result.companies.length !== 1 ? "es" : ""}
                    </p>
                    <div className={`grid grid-cols-1 gap-4 ${result.companies.length === 1 ? "sm:grid-cols-1" : result.companies.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                      {result.companies.map((match, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl bg-white border-2 border-amber-300 p-5 flex justify-center"
                        >
                          <div className="flex items-start gap-3 text-left">
                            <CheckCircle2 className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                            <p className="font-semibold text-slate-800">
                              {match.company}
                            </p>
                            <p className="text-sm text-slate-500 whitespace-nowrap">
                              This is a <span className="font-semibold text-amber-600">remote area</span>
                            </p>
                            {match.area?.low != null && match.area?.high != null && (
                              <p className="text-xs text-slate-400 whitespace-nowrap">
                                Zip range: {match.area.low} &ndash; {match.area.high}
                              </p>
                            )}
                            {match.area?.city && (
                              <p className="text-xs text-slate-400">City: {match.area.city}</p>
                            )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
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
        <div className="flex-1 min-w-0 hidden lg:block" aria-hidden />
      </div>
    </div>
  );
}
