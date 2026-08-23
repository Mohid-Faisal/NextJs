"use client";

/**
 * Dynamically-loaded recharts exports.
 *
 * Bundle diet (#10): recharts is ~100kB+ gzipped and only needed for charts.
 * Importing it statically in page components pulls it into the initial JS
 * bundle even for users who never scroll to the charts. These wrappers load
 * it on demand, client-side.
 *
 * Usage — identical to importing from "recharts":
 *   import { AreaChart, Area, ResponsiveContainer } from "@/components/charts";
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const load = (name: string): ComponentType<any> =>
  dynamic(
    () =>
      import("recharts").then((m) => ({
        default: m[name as keyof typeof m] as ComponentType<any>,
      })),
    {
      ssr: false,
      loading: () => (
        <div className="w-full h-full min-h-[200px] animate-pulse rounded-lg bg-slate-200/60 dark:bg-zinc-800/60" />
      ),
    }
  );

export const ResponsiveContainer = load("ResponsiveContainer");
export const AreaChart = load("AreaChart");
export const Area = load("Area");
export const BarChart = load("BarChart");
export const Bar = load("Bar");
export const LineChart = load("LineChart");
export const Line = load("Line");
export const PieChart = load("PieChart");
export const Pie = load("Pie");
export const Cell = load("Cell");
export const RadarChart = load("RadarChart");
export const Radar = load("Radar");
export const PolarGrid = load("PolarGrid");
export const PolarAngleAxis = load("PolarAngleAxis");
export const PolarRadiusAxis = load("PolarRadiusAxis");
export const XAxis = load("XAxis");
export const YAxis = load("YAxis");
export const CartesianGrid = load("CartesianGrid");
export const Tooltip = load("Tooltip");
export const Legend = load("Legend");
