"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Country } from "country-state-city";

const documentTypes = [
  "Document",
  "Non Document",
  "FedEx Pak"
];

const RateCalculator = () => {
  const [form, setForm] = useState({
    weight: "",
    length: "",
    width: "",
    height: "",
    origin: "Pakistan",
    destination: "",
    docType: "",
    profitPercentage: "",
  });

  const [countries, setCountries] = useState<any[]>([]);
  const [results, setResults] = useState<{
    profitPercentage: number;
    fixedCharge: {
      weight: number;
      amount: number;
    } | null;
    zones: Array<{
      zone: number;
      country: string;
      service: string;
      bestRate: { 
        weight: number; 
        price: number; 
        vendor: string;
        originalPrice: number;
      };
    }>;
    bestOverallRate: {
      zone: number;
      country: string;
      service: string;
      bestRate: { 
        weight: number; 
        price: number; 
        vendor: string;
        originalPrice: number;
      };
    };
    allRates: Array<{
      zone: number;
      weight: number;
      price: number;
      vendor: string;
      service: string;
      originalPrice: number;
    }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load countries on component mount
  useEffect(() => {
    const allCountries = Country.getAllCountries();
    setCountries(allCountries);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      e.target.type === "number"
        ? Math.max(0, Number(e.target.value)).toString()
        : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSelect = (value: string, field: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleCalculate = async () => {
    const { weight, length, width, height, origin, destination, docType, profitPercentage } = form;
    const w = parseFloat(weight);
    const l = parseFloat(length);
    const wd = parseFloat(width);
    const h = parseFloat(height);
    const profit = parseFloat(profitPercentage);
    console.log(`📍 Weight:`, w);

    if ([w, l, wd, h].some((v) => isNaN(v) || v <= 0)) {
      setError("Please enter valid positive numbers for all dimensions and weight.");
      setResults(null);
      return;
    }

    if (!origin || !destination || !docType) {
      setError("Please fill in all required fields: Origin, Destination, and Document Type.");
      setResults(null);
      return;
    }

    if (isNaN(profit) || profit < 0) {
      setError("Please enter a valid profit percentage (0 or greater).");
      setResults(null);
      return;
    }

    setError(null);
    setLoading(true);
    console.log(`📍 weight:`, w);
    try {
      const res = await fetch("/api/rate-calc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          origin, 
          destination, 
          weight: w,
          docType,
          height: h,
          width: wd,
          length: l,
          profitPercentage: profit
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No matching rate found.");
        setResults(null);
      } else {
        setResults(data);
      }
    } catch (err) {
      setError("Something went wrong while fetching rates.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 xl:p-10 w-full bg-white dark:bg-zinc-900 transition-all duration-300 ease-in-out ml-0 lg:ml-0">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-7xl mx-auto"
      >
        <Card className="w-full min-h-[calc(100vh-10rem)] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <CardContent className="p-3 sm:p-4 lg:p-6 overflow-y-auto h-full">
            <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold mb-4 sm:mb-6 lg:mb-8 text-center text-primary">
              Rate Calculator
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-xs sm:text-sm">Origin</Label>
                <Select onValueChange={(value) => handleSelect(value, "origin")} value={form.origin}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select an origin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((country) => (
                      <SelectItem 
                        key={country.isoCode} 
                        value={country.name}
                        className={`text-xs sm:text-sm ${
                          form.origin === country.name 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="text-xs sm:text-sm">Destination</Label>
                <Select onValueChange={(value) => handleSelect(value, "destination")} value={form.destination}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select a destination" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {countries.map((country) => (
                      <SelectItem 
                        key={country.isoCode} 
                        value={country.name}
                        className={`text-xs sm:text-sm ${
                          form.destination === country.name 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="docType" className="text-xs sm:text-sm">Document Type</Label>
                <Select onValueChange={(value) => handleSelect(value, "docType")} value={form.docType}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem 
                        key={type} 
                        value={type}
                        className={`text-xs sm:text-sm ${
                          form.docType === type 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profitPercentage" className="text-xs sm:text-sm">Profit Percentage (%)</Label>
                <Input
                  id="profitPercentage"
                  name="profitPercentage"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.profitPercentage}
                  onChange={handleChange}
                  placeholder="10"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight" className="text-xs sm:text-sm">Weight (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.weight}
                  onChange={handleChange}
                  placeholder="0.5"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="length" className="text-xs sm:text-sm">Length (cm)</Label>
                <Input
                  id="length"
                  name="length"
                  type="number"
                  min="0"
                  value={form.length}
                  onChange={handleChange}
                  placeholder="10"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width" className="text-xs sm:text-sm">Width (cm)</Label>
                <Input
                  id="width"
                  name="width"
                  type="number"
                  min="0"
                  value={form.width}
                  onChange={handleChange}
                  placeholder="10"
                  className="text-xs sm:text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height" className="text-xs sm:text-sm">Height (cm)</Label>
                <Input
                  id="height"
                  name="height"
                  type="number"
                  min="0"
                  value={form.height}
                  onChange={handleChange}
                  placeholder="10"
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>

            <Button 
              className="w-full mt-4 sm:mt-6 text-sm sm:text-base lg:text-lg" 
              onClick={handleCalculate}
              disabled={loading}
            >
              {loading ? "Calculating..." : "Calculate Rate"}
            </Button>

            {error && (
              <div className="text-red-500 text-center mt-4 font-medium text-xs sm:text-sm">
                {error}
              </div>
            )}

            {results && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 sm:mt-6 space-y-3 sm:space-y-4"
              >
                {/* Fixed Charges Information */}
                {results.fixedCharge && (
                  <Card className="bg-purple-50 dark:bg-purple-950 border border-purple-300 dark:border-purple-700">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-0">
                        <div>
                          <h3 className="font-semibold text-purple-800 dark:text-purple-200 text-sm sm:text-base lg:text-lg">
                            💰 Fixed Charges
                          </h3>
                          <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-300">
                            <span className="hidden sm:inline">Weight: {results.fixedCharge.weight}kg | Applied to shipments ≥ {results.fixedCharge.weight}kg</span>
                            <span className="sm:hidden">W: {results.fixedCharge.weight}kg | ≥ {results.fixedCharge.weight}kg</span>
                          </p>
                        </div>
                        <div className="text-left lg:text-right">
                          <p className="text-sm sm:text-base lg:text-lg font-bold text-purple-800 dark:text-purple-200">
                            Rs. {results.fixedCharge.amount}
                          </p>
                          <p className="text-xs text-purple-500 dark:text-purple-400">
                            <span className="hidden sm:inline">Additional fixed charge</span>
                            <span className="sm:hidden">Fixed charge</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Best Overall Rate */}
                <Card className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 lg:gap-0">
                      <div>
                        <h3 className="font-semibold text-green-800 dark:text-green-200 text-sm sm:text-base lg:text-lg">
                          🏆 Best Overall Rate
                        </h3>
                        <p className="text-xs sm:text-sm text-green-600 dark:text-green-300">
                          <span className="hidden sm:inline">Country: {results.bestOverallRate.country} | Zone: {results.bestOverallRate.zone} | Service: {results.bestOverallRate.service}</span>
                          <span className="sm:hidden">{results.bestOverallRate.country} | Z{results.bestOverallRate.zone} | {results.bestOverallRate.service}</span>
                        </p>
                        {results.profitPercentage > 0 && (
                          <p className="text-xs text-green-500 dark:text-green-400">
                            <span className="hidden sm:inline">Profit: +{results.profitPercentage}% | Original: Rs. {results.bestOverallRate.bestRate.originalPrice}</span>
                            <span className="sm:hidden">+{results.profitPercentage}% | Orig: Rs. {results.bestOverallRate.bestRate.originalPrice}</span>
                          </p>
                        )}
                        {results.fixedCharge && (
                          <p className="text-xs text-green-500 dark:text-green-400">
                            <span className="hidden sm:inline">Fixed Charge: Rs. {results.fixedCharge.amount} | Total: Rs. {results.bestOverallRate.bestRate.price + results.fixedCharge.amount}</span>
                            <span className="sm:hidden">Fixed: Rs. {results.fixedCharge.amount} | Total: Rs. {results.bestOverallRate.bestRate.price + results.fixedCharge.amount}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-sm sm:text-base lg:text-lg font-bold text-green-800 dark:text-green-200">
                          Rs. {results.bestOverallRate.bestRate.price}
                        </p>
                        <p className="text-xs sm:text-sm text-green-600 dark:text-green-300">
                          <span className="hidden sm:inline">Weight: {results.bestOverallRate.bestRate.weight}kg | Vendor: {results.bestOverallRate.bestRate.vendor}</span>
                          <span className="sm:hidden">{results.bestOverallRate.bestRate.weight}kg | {results.bestOverallRate.bestRate.vendor}</span>
                        </p>
                        <p className="text-xs text-green-500 dark:text-green-400">
                          <span className="hidden sm:inline">Price per kg: Rs. {(results.bestOverallRate.bestRate.price / results.bestOverallRate.bestRate.weight).toFixed(2)}</span>
                          <span className="sm:hidden">Rs. {(results.bestOverallRate.bestRate.price / results.bestOverallRate.bestRate.weight).toFixed(2)}/kg</span>
                        </p>
                        {results.fixedCharge && (
                          <p className="text-xs text-green-500 dark:text-green-400">
                            <span className="hidden sm:inline">+ Fixed: Rs. {results.fixedCharge.amount}</span>
                            <span className="sm:hidden">+ Fixed: Rs. {results.fixedCharge.amount}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* All Zones Information */}
                <Card className="bg-blue-50 dark:bg-blue-950 border border-blue-300 dark:border-blue-700">
                  <CardContent className="p-3 sm:p-4">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 sm:mb-3 text-sm sm:text-base">
                      Available Zones & Services
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3">
                      {results.zones.map((zone, index) => (
                        <div 
                          key={index}
                          className={`p-2 sm:p-3 rounded border ${
                            zone.zone === results.bestOverallRate.zone 
                              ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-600' 
                              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-xs sm:text-sm">
                                Zone {zone.zone}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {zone.service} • {zone.bestRate.vendor}
                              </p>
                              {results.profitPercentage > 0 && (
                                <p className="text-xs text-blue-500 dark:text-blue-400">
                                  +{results.profitPercentage}% | Orig: Rs. {zone.bestRate.originalPrice}
                                </p>
                              )}
                              {results.fixedCharge && (
                                <p className="text-xs text-purple-500 dark:text-purple-400">
                                  Fixed: Rs. {results.fixedCharge.amount}
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-xs sm:text-sm">
                                Rs. {zone.bestRate.price}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {zone.bestRate.weight}kg
                              </p>
                              <p className="text-xs text-blue-500 dark:text-blue-400">
                                Rs. {(zone.bestRate.price / zone.bestRate.weight).toFixed(2)}/kg
                              </p>
                              {results.fixedCharge && (
                                <p className="text-xs text-purple-500 dark:text-purple-400">
                                  Total: Rs. {zone.bestRate.price + results.fixedCharge.amount}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* All Available Rates Table */}
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base lg:text-lg">
                      All Available Rates ({results.zones.length} zones)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm border-separate border-spacing-y-1 sm:border-spacing-y-2">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Service</span>
                              <span className="sm:hidden">Svc</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Zone</span>
                              <span className="sm:hidden">Z</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Vendor</span>
                              <span className="sm:hidden">V</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Weight (kg)</span>
                              <span className="sm:hidden">W</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Original Price (Rs.)</span>
                              <span className="sm:hidden">Orig</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Final Price (Rs.)</span>
                              <span className="sm:hidden">Final</span>
                            </th>
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Price per kg (Rs.)</span>
                              <span className="sm:hidden">Rs/kg</span>
                            </th>
                            {results.fixedCharge && (
                              <th className="text-left py-2 px-2 sm:px-4">
                                <span className="hidden sm:inline">Fixed Charge (Rs.)</span>
                                <span className="sm:hidden">Fixed</span>
                              </th>
                            )}
                            <th className="text-left py-2 px-2 sm:px-4">
                              <span className="hidden sm:inline">Status</span>
                              <span className="sm:hidden">S</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.allRates.map((rate, index) => (
                            <tr 
                              key={index} 
                              className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                rate.zone === results.bestOverallRate.zone && 
                                rate.weight === results.bestOverallRate.bestRate.weight && 
                                rate.price === results.bestOverallRate.bestRate.price ? 
                                'bg-green-50 dark:bg-green-950' : ''
                              }`}
                            >
                              <td className="py-2 px-2 sm:px-4 font-medium">
                                <span className="hidden sm:inline">{rate.service}</span>
                                <span className="sm:hidden">{rate.service?.substring(0, 8)}...</span>
                              </td>
                              <td className="py-2 px-2 sm:px-4">{rate.zone}</td>
                              <td className="py-2 sm:px-4">
                                <span className="hidden sm:inline">{rate.vendor}</span>
                                <span className="sm:hidden">{rate.vendor?.substring(0, 6)}...</span>
                              </td>
                              <td className="py-2 px-2 sm:px-4">{rate.weight}</td>
                              <td className="py-2 px-2 sm:px-4 text-gray-600 dark:text-gray-400">
                                <span className="hidden sm:inline">{rate.originalPrice}</span>
                                <span className="sm:hidden">{rate.originalPrice}</span>
                              </td>
                              <td className="py-2 px-2 sm:px-4 font-medium">{rate.price}</td>
                              <td className="py-2 px-2 sm:px-4 text-blue-600 dark:text-blue-400">{(rate.price / rate.weight).toFixed(2)}</td>
                              {results.fixedCharge && (
                                <td className="py-2 px-2 sm:px-4 text-purple-600 dark:text-purple-400">
                                  {results.fixedCharge.amount}
                                </td>
                              )}
                              <td className="py-2 px-2 sm:px-4">
                                {rate.zone === results.bestOverallRate.zone && 
                                 rate.weight === results.bestOverallRate.bestRate.weight && 
                                 rate.price === results.bestOverallRate.bestRate.price ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    <span className="hidden sm:inline">✓ Best Overall</span>
                                    <span className="sm:hidden">✓ Best</span>
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    <span className="hidden sm:inline">Available</span>
                                    <span className="sm:hidden">Avail</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default RateCalculator;
