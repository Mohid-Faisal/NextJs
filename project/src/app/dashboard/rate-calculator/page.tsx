"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === "number" ? Math.max(0, Number(e.target.value)).toString() : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSelect = (value: string) => {
    setForm({ ...form, destination: value });
  };

  const calculateRate = () => {
    const { weight, length, width, height } = form;
    const w = parseFloat(weight);
    const l = parseFloat(length);
    const wd = parseFloat(width);
    const h = parseFloat(height);

    if ([w, l, wd, h].some((v) => isNaN(v) || v < 0)) {
      setError("Please enter valid positive numbers for all dimensions and weight.");
      setRate(null);
      return;
    }

    setError(null);
    const volume = l * wd * h;
    const baseRate = 100;
    const rate = baseRate + w * 10 + volume * 0.05;
    setRate(parseFloat(rate.toFixed(2)));
  };

  return (
    <div className="h-[calc(100vh-8rem)] w-full flex items-center justify-center bg-gray-50 dark:bg-background overflow-hidden">
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

            <Button className="w-full mt-6 text-lg" onClick={calculateRate}>
              Calculate Rate
            </Button>

            {error && (
              <div className="text-red-500 text-center mt-2 font-medium">{error}</div>
            )}

            {rate !== null && !error && (
              <div className="text-xl font-semibold text-green-600 text-center mt-4">
                Estimated Shipping Rate: Rs. {rate}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RateCalculator;
