"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export type TablePageSize = number | "all";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: TablePageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: TablePageSize) => void;
  pageSizeOptions?: number[];
  showAllOption?: boolean;
  showPageSize?: boolean;
  entityName?: string;
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showAllOption = true,
  showPageSize = true,
  entityName = "entries",
  className = "",
}: TablePaginationProps) {
  if (total <= 0) return null;

  const safeTotalPages = Math.max(1, totalPages);
  const isAll = pageSize === "all";
  const size = isAll ? total : (pageSize as number);
  const start = isAll ? 1 : (page - 1) * size + 1;
  const end = isAll ? total : Math.min(page * size, total);

  const summary = isAll
    ? `Showing all ${total} ${entityName}`
    : `Showing ${start} to ${end} of ${total} ${entityName}`;

  return (
    <div
      className={`mt-4 sm:mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600 dark:text-gray-300 ${className}`}
    >
      <div className="text-center sm:text-left">{summary}</div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">
              Rows per page
            </span>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                onPageSizeChange(value === "all" ? "all" : parseInt(value, 10));
                onPageChange(1);
              }}
            >
              <SelectTrigger className="h-9 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
                {showAllOption && <SelectItem value="all">All</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
          <span className="whitespace-nowrap">
            Page {page} of {safeTotalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={page <= 1 || isAll}
              onClick={() => onPageChange(1)}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={page <= 1 || isAll}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={page >= safeTotalPages || isAll}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={page >= safeTotalPages || isAll}
              onClick={() => onPageChange(safeTotalPages)}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
