"use client";

import { useRef } from "react";
import { Combobox } from "@headlessui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import countries from "../../data/countries.json"; // Ensure this is an array of { name, code }

type CountryOption = {
  name: string;
  code: string;
};

const countryList = countries as CountryOption[];

export default function CountryCombobox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const filteredCountries = countryList;

  const rowVirtualizer = useVirtualizer({
    count: filteredCountries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const selectedName =
    countryList.find((c) => c.code === value)?.name || "Select a country";

  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative w-64">
        {/* Dropdown trigger */}
        <Combobox.Button className="w-full">
          <div className="flex items-center justify-between w-full rounded-md border border-input bg-background px-4 py-2 text-sm text-foreground shadow-sm hover:border-border focus:outline-none focus:ring-2 focus:ring-ring/40 transition cursor-pointer">
            {selectedName}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </Combobox.Button>

        {/* Dropdown options */}
        <Combobox.Options
          static
          ref={parentRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg focus:outline-none"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map(
              (virtualRow: { key: string | number; index: number; start: number }) => {
                const country = filteredCountries[virtualRow.index] as CountryOption | undefined;
                if (!country) return null;
                return (
                  <Combobox.Option
                    key={country.code}
                    value={country.code}
                    className={({ active, selected }: { active: boolean; selected: boolean }) =>
                      `absolute top-0 left-0 w-full cursor-pointer select-none px-4 py-2 text-sm ${
                        active
                          ? "bg-blue-500 text-white"
                          : selected
                          ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100"
                          : "text-foreground hover:bg-accent"
                      }`
                    }
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {country.name} ({country.code})
                  </Combobox.Option>
                );
              }
            )}
          </div>
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
