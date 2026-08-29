/** Convert Prisma Decimal / numeric input to a finite JS number. */
export function money(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const MAX_LIST_PAGE_SIZE = 2000;

/** Parse `page`/`limit` query params. `limit=all` is capped, never unbounded. */
export function parseListPaging(
  searchParams: { get: (key: string) => string | null },
  defaultLimit = 10,
  max = MAX_LIST_PAGE_SIZE
): { take: number; skip: number; page: number } {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const raw = searchParams.get("limit");
  let take = defaultLimit;
  if (raw && (raw.toLowerCase() === "all" || raw.toLowerCase() === "none")) {
    take = max;
  } else if (raw) {
    take = parseInt(raw, 10);
    if (!Number.isFinite(take) || take < 1) take = defaultLimit;
    take = Math.min(max, take);
  }
  return { page, take, skip: (page - 1) * take };
}
