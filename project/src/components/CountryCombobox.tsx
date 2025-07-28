"use client";

import { useMemo, useState, useRef } from "react";
import { Combobox } from "@headlessui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown } from "lucide-react";
import countries from "../../data/countries.json"; // Ensure this is an array of { name, code }

export default function CountryCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [query, setQuery] = useState("");
  const parentRef = useRef(null);

  const filteredCountries = useMemo(() => {
    return query === ""
      ? countries
      : countries.filter((c: any) =>
          c.name.toLowerCase().includes(query.toLowerCase())
        );
  }, [query]);

  const rowVirtualizer = useVirtualizer({
    count: filteredCountries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const selectedName =
    countries.find((c: any) => c.code === value)?.name || "Select a country";

  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative w-64">
        {/* Dropdown trigger */}
        <Combobox.Button className="w-full">
          <div className="flex items-center justify-between w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 transition cursor-pointer">
            {selectedName}
            <ChevronDown className="h-4 w-4 text-gray-500" />
          </div>
        </Combobox.Button>

        {/* Dropdown options */}
        <Combobox.Options
          static
          ref={parentRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg focus:outline-none"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const country = filteredCountries[virtualRow.index];
              return (
                <Combobox.Option
                  key={country.code}
                  value={country.code}
                  className={({ active, selected }) =>
                    `absolute top-0 left-0 w-full cursor-pointer select-none px-4 py-2 text-sm ${
                      active
                        ? "bg-blue-500 text-white"
                        : selected
                        ? "bg-blue-100 text-blue-900"
                        : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {country.name} ({country.code})
                </Combobox.Option>
              );
            })}
          </div>
        </Combobox.Options>
      </div>
    </Combobox>
  );
}
