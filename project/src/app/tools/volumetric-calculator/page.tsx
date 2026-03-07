"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Package, ArrowRight, Scale, Ruler } from "lucide-react";

export default function VolumetricCalculatorPage() {
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [actualWeight, setActualWeight] = useState("");
  const [result, setResult] = useState<{
    volumeCm3: number;
    volumetricWeight: number;
    actualWeight: number;
    chargedWeight: number;
    useVolumetric: boolean;
  } | null>(null);

  const handleCalculate = () => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;
    const aw = parseFloat(actualWeight) || 0;

    if (l <= 0 || w <= 0 || h <= 0) return;

    const volumeCm3 = l * w * h;
    const volumetricWeight = volumeCm3 / 5000;
    const volumetricCeil = Math.ceil(volumetricWeight);
    const chargedWeight = Math.max(volumetricCeil, aw);

    setResult({
      volumeCm3,
      volumetricWeight,
      actualWeight: aw,
      chargedWeight,
      useVolumetric: volumetricCeil > aw,
    });
  };

  const handleReset = () => {
    setLength("");
    setWidth("");
    setHeight("");
    setActualWeight("");
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-snug">
              <span className="bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                Volumetric weight
              </span>
              <br />
              <span className="text-slate-800">calculator</span>
            </h1>
            <p className="text-slate-500 mt-3 text-base sm:text-lg max-w-lg mx-auto">
              Calculate the volumetric weight of your parcel to know the charged shipping weight
            </p>
          </div>

          {/* Form */}
          <div className="rounded-2xl bg-slate-100 p-5 sm:p-7 space-y-5">
            {/* Dimensions */}
            <div>
              <Label className="text-xs font-bold tracking-wide text-slate-600 mb-2 block">
                Parcel dimensions (cm)
              </Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Length</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={length}
                    onChange={(e) => { setLength(e.target.value); setResult(null); }}
                    className="h-[46px] bg-white border-slate-200 rounded-xl text-sm text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Width</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={width}
                    onChange={(e) => { setWidth(e.target.value); setResult(null); }}
                    className="h-[46px] bg-white border-slate-200 rounded-xl text-sm text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-400">Height</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="0"
                    value={height}
                    onChange={(e) => { setHeight(e.target.value); setResult(null); }}
                    className="h-[46px] bg-white border-slate-200 rounded-xl text-sm text-center"
                  />
                </div>
              </div>
            </div>

            {/* Actual weight */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold tracking-wide text-slate-600">
                Actual weight (kg)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={actualWeight}
                onChange={(e) => { setActualWeight(e.target.value); setResult(null); }}
                className="h-[46px] bg-white border-slate-200 rounded-xl text-sm"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleCalculate}
                className="flex-1 h-[46px] rounded-xl bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-semibold text-sm"
              >
                Calculate <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={handleReset}
                variant="outline"
                className="h-[46px] rounded-xl border-slate-300 text-slate-600 text-sm px-6"
              >
                Reset
              </Button>
            </div>

            {/* Formula note */}
            <p className="text-xs text-slate-400 text-center">
              Formula: (Length &times; Width &times; Height) &divide; 5,000 = Volumetric weight (kg)
            </p>
          </div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 space-y-4"
              >
                {/* Result cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center">
                    <Ruler className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Volume</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {result.volumeCm3.toLocaleString()} <span className="text-sm font-normal text-slate-400">cm&sup3;</span>
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center">
                    <Package className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Volumetric weight</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {result.volumetricWeight.toFixed(2)} <span className="text-sm font-normal text-slate-400">kg</span>
                    </p>
                  </div>
                </div>

                {result.actualWeight > 0 && (
                  <div className="rounded-2xl bg-white border border-slate-200 p-5 text-center">
                    <Scale className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Actual weight</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">
                      {result.actualWeight.toFixed(2)} <span className="text-sm font-normal text-slate-400">kg</span>
                    </p>
                  </div>
                )}

                {/* Charged weight */}
                <div className={`rounded-2xl p-6 text-center border-2 ${
                  result.useVolumetric
                    ? "bg-sky-50 border-sky-300"
                    : "bg-emerald-50 border-emerald-300"
                }`}>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1 text-slate-500">
                    Charged weight
                  </p>
                  <p className={`text-3xl font-extrabold ${
                    result.useVolumetric ? "text-sky-600" : "text-emerald-600"
                  }`}>
                    {result.chargedWeight.toFixed(2)} <span className="text-lg font-semibold">kg</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-2">
                    {result.actualWeight > 0
                      ? result.useVolumetric
                        ? "Volumetric weight is greater than actual weight, so it will be used for billing."
                        : "Actual weight is greater than or equal to volumetric weight, so it will be used for billing."
                      : "Enter your actual weight above to compare with volumetric weight."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
