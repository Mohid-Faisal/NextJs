"use client";

import Link from "next/link";
import { FaCalculator, FaSearch, FaBox, FaMapMarkerAlt } from "react-icons/fa";

const tools = [
  { href: "/rate-calculator", label: "Rate calculator", icon: FaCalculator },
  { href: "/tracking", label: "Shipment tracking", icon: FaSearch },
  { href: "/tools/volumetric-calculator", label: "Volumetric calculator", icon: FaBox },
  { href: "/tools/remote-area-lookup", label: "Remote area lookup", icon: FaMapMarkerAlt },
];

type CurrentTool = "rate-calculator" | "tracking";

export default function OtherToolsStrip({ currentTool }: { currentTool: CurrentTool }) {
  const currentPath = currentTool === "rate-calculator" ? "/rate-calculator" : "/tracking";
  const otherTools = tools.filter((t) => t.href !== currentPath);

  return (
    <div className="mb-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
        Which other tool do you want to use?
      </p>
      <div className="flex flex-wrap gap-2">
        {otherTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.href}
              href={tool.href}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:border-sky-200 dark:hover:border-sky-700 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tool.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
