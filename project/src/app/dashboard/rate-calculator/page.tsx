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
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto px-4"
    >
      <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center dark:bg-background overflow-hidden">
        <div className="w-full max-w-6xl">
          <Card className="w-full h-[calc(100vh-10rem)] border border-gray-200 dark:border-gray-700 overflow-hidden">
            <CardContent className="p-6 overflow-y-auto h-full">
              <h1 className="text-3xl font-bold mb-8 text-center text-primary">
                Rate Calculator
              </h1>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origin">Origin</Label>
                  <Select onValueChange={(value) => handleSelect(value, "origin")} value={form.origin}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select an origin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {countries.map((country) => (
                                                 <SelectItem 
                           key={country.isoCode} 
                           value={country.name}
                           className={`${
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
                  <Label htmlFor="destination">Destination</Label>
                  <Select onValueChange={(value) => handleSelect(value, "destination")} value={form.destination}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a destination" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {countries.map((country) => (
                                                 <SelectItem 
                           key={country.isoCode} 
                           value={country.name}
                           className={`${
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
                  <Label htmlFor="docType">Document Type</Label>
                  <Select onValueChange={(value) => handleSelect(value, "docType")} value={form.docType}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes.map((type) => (
                                                 <SelectItem 
                           key={type} 
                           value={type}
                           className={`${
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
                  <Label htmlFor="profitPercentage">Profit Percentage (%)</Label>
                  <Input
                    id="profitPercentage"
                    name="profitPercentage"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.profitPercentage}
                    onChange={handleChange}
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    name="weight"
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.weight}
                    onChange={handleChange}
                    placeholder="0.5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="length">Length (cm)</Label>
                  <Input
                    id="length"
                    name="length"
                    type="number"
                    min="0"
                    value={form.length}
                    onChange={handleChange}
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="width">Width (cm)</Label>
                  <Input
                    id="width"
                    name="width"
                    type="number"
                    min="0"
                    value={form.width}
                    onChange={handleChange}
                    placeholder="10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input
                    id="height"
                    name="height"
                    type="number"
                    min="0"
                    value={form.height}
                    onChange={handleChange}
                    placeholder="10"
                  />
                </div>
              </div>

              <Button 
                className="w-full mt-6 text-lg" 
                onClick={handleCalculate}
                disabled={loading}
              >
                {loading ? "Calculating..." : "Calculate Rate"}
              </Button>

              {error && (
                <div className="text-red-500 text-center mt-4 font-medium">
                  {error}
                </div>
              )}

              {results && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 space-y-4"
                >
                  {/* Best Overall Rate */}
                  <Card className="bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-green-800 dark:text-green-200">
                            🏆 Best Overall Rate
                          </h3>
                          <p className="text-sm text-green-600 dark:text-green-300">
                            Country: {results.bestOverallRate.country} | Zone: {results.bestOverallRate.zone} | Service: {results.bestOverallRate.service}
                          </p>
                          {results.profitPercentage > 0 && (
                            <p className="text-xs text-green-500 dark:text-green-400">
                              Profit: +{results.profitPercentage}% | Original: Rs. {results.bestOverallRate.bestRate.originalPrice}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-800 dark:text-green-200">
                            Rs. {results.bestOverallRate.bestRate.price}
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-300">
                            Weight: {results.bestOverallRate.bestRate.weight}kg | Vendor: {results.bestOverallRate.bestRate.vendor}
                          </p>
                          <p className="text-xs text-green-500 dark:text-green-400">
                            Price per kg: Rs. {(results.bestOverallRate.bestRate.price / results.bestOverallRate.bestRate.weight).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* All Zones Information */}
                  <Card className="bg-blue-50 dark:bg-blue-950 border border-blue-300 dark:border-blue-700">
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">
                        Available Zones & Services
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {results.zones.map((zone, index) => (
                          <div 
                            key={index}
                            className={`p-3 rounded border ${
                              zone.zone === results.bestOverallRate.zone 
                                ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-600' 
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">
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
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm">
                                  Rs. {zone.bestRate.price}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {zone.bestRate.weight}kg
                                </p>
                                <p className="text-xs text-blue-500 dark:text-blue-400">
                                  Rs. {(zone.bestRate.price / zone.bestRate.weight).toFixed(2)}/kg
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* All Available Rates Table */}
                  <Card>
                    <CardContent className="p-4">
                      <h3 className="font-semibold mb-4 text-lg">
                        All Available Rates ({results.zones.length} zones)
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-4">Service</th>
                              <th className="text-left py-2 px-4">Zone</th>
                              <th className="text-left py-2 px-4">Vendor</th>
                              <th className="text-left py-2 px-4">Weight (kg)</th>
                              <th className="text-left py-2 px-4">Original Price (Rs.)</th>
                              <th className="text-left py-2 px-4">Final Price (Rs.)</th>
                              <th className="text-left py-2 px-4">Price per kg (Rs.)</th>
                              <th className="text-left py-2 px-4">Status</th>
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
                                <td className="py-2 px-4 font-medium">{rate.service}</td>
                                <td className="py-2 px-4">{rate.zone}</td>
                                <td className="py-2 px-4">{rate.vendor}</td>
                                <td className="py-2 px-4">{rate.weight}</td>
                                <td className="py-2 px-4 text-gray-600 dark:text-gray-400">{rate.originalPrice}</td>
                                <td className="py-2 px-4 font-medium">{rate.price}</td>
                                <td className="py-2 px-4 text-blue-600 dark:text-blue-400">{(rate.price / rate.weight).toFixed(2)}</td>
                                <td className="py-2 px-4">
                                  {rate.zone === results.bestOverallRate.zone && 
                                   rate.weight === results.bestOverallRate.bestRate.weight && 
                                   rate.price === results.bestOverallRate.bestRate.price ? (
                                    <span className="text-green-600 dark:text-green-400 font-medium">
                                      ✓ Best Overall
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">Available</span>
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
        </div>
      </div>
    </motion.div>
  );
};

export default RateCalculator;
