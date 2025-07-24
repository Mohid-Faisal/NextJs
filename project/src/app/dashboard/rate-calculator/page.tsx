"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const destinations = [
  "Middle East",
  "Great Britain",
  "Greater China",
  "New Zealand",
  "USA and Canada",
  "Rest of Western Europe",
  "Rest of Asia",
  "Rest of the World",
  "AU",
  "AE",
  "SA",
];

const RateCalculator = () => {
  const [form, setForm] = useState({
    weight: "",
    length: "",
    width: "",
    height: "",
    origin: "",
    destination: "",
  });

  const [rates, setRates] = useState<{
    doc?: number;
    nonDoc?: number;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value =
      e.target.type === "number"
        ? Math.max(0, Number(e.target.value)).toString()
        : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSelect = (value: string) => {
    setForm({ ...form, destination: value });
  };

  const handleCalculate = async () => {
    const { weight, length, width, height, destination } = form;
    const w = parseFloat(weight);
    const l = parseFloat(length);
    const wd = parseFloat(width);
    const h = parseFloat(height);

    if ([w, l, wd, h].some((v) => isNaN(v) || v <= 0)) {
      setError(
        "Please enter valid positive numbers for all dimensions and weight."
      );
      setRates(null);
      return;
    }

    setError(null);

    try {
      const res = await fetch("/api/rate-calc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          region: destination,
          weight: w,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "No matching rate found.");
        setRates(null);
      } else {
        setRates({
          doc: data.DOC ? parseFloat(data.DOC) : undefined,
          nonDoc: data.NON_DOC ? parseFloat(data.NON_DOC) : undefined,
        });
      }
    } catch (err) {
      setError("Something went wrong while fetching rates.");
      setRates(null);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center dark:bg-background overflow-hidden">
      <div className="w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-4 text-center text-primary">
          Rate Calculator
        </h1>

        <Card className="w-full h-[calc(100vh-16rem)] border border-gray-200 dark:border-gray-700 overflow-hidden">
          <CardContent className="p-6 overflow-y-auto h-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="origin">Origin</Label>
                <Input
                  id="origin"
                  name="origin"
                  value={form.origin}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination">Destination</Label>
                <Select onValueChange={handleSelect} value={form.destination}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinations.map((dest) => (
                      <SelectItem key={dest} value={dest}>
                        {dest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  name="weight"
                  type="number"
                  min="0"
                  value={form.weight}
                  onChange={handleChange}
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
                />
              </div>
            </div>

            <Button className="w-full mt-6 text-lg" onClick={handleCalculate}>
              Calculate Rate
            </Button>

            {error && (
              <div className="text-red-500 text-center mt-2 font-medium">
                {error}
              </div>
            )}

            {rates && (
              <div className="mt-6 flex justify-center">
                <Card className="w-full max-w-md bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-700 shadow-md">
                  <CardContent className="p-6 space-y-4 text-center">
                    <h2 className="text-2xl font-bold text-green-700 dark:text-green-300">
                      Estimated Shipping Rates
                    </h2>

                    {rates.doc !== undefined && (
                      <div className="text-lg flex items-center justify-between px-4">
                        <span className="text-green-600 dark:text-green-300">
                          📄 DHL Doc rate
                        </span>
                        <span className="font-semibold text-green-800 dark:text-green-100">
                          Rs. {rates.doc}
                        </span>
                      </div>
                    )}

                    {rates.nonDoc !== undefined && (
                      <div className="text-lg flex items-center justify-between px-4">
                        <span className="text-green-600 dark:text-green-300">
                          📦 DHL Non-Doc rate
                        </span>
                        <span className="font-semibold text-green-800 dark:text-green-100">
                          Rs. {rates.nonDoc}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RateCalculator;
