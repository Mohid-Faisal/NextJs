"use client";

import React from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ColumnOption {
  id: string;
  label: string;
}

interface TableViewOptionsProps {
  columns: ColumnOption[];
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (columnId: string) => void;
  className?: string;
  buttonSize?: "sm" | "default";
}

export function TableViewOptions({
  columns,
  visibleColumns,
  onToggleColumn,
  className,
  buttonSize = "sm",
}: TableViewOptionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={buttonSize}
          className={`h-9 px-3 text-xs sm:text-sm font-medium border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 gap-1.5 shadow-sm shrink-0 ${className || ""}`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>View</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-md">
        <DropdownMenuLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Toggle Columns
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => {
          const isChecked = visibleColumns[column.id] !== false;
          return (
            <DropdownMenuCheckboxItem
              key={column.id}
              className="text-xs sm:text-sm cursor-pointer"
              checked={isChecked}
              onCheckedChange={() => onToggleColumn(column.id)}
            >
              {column.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
