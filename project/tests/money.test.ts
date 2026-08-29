import { describe, expect, it } from "vitest";
import { money, parseListPaging, MAX_LIST_PAGE_SIZE } from "../src/lib/money";

describe("money", () => {
  it("coerces numbers, numeric strings, and nullish", () => {
    expect(money(12.5)).toBe(12.5);
    expect(money("8.25")).toBe(8.25);
    expect(money(null)).toBe(0);
    expect(money(undefined)).toBe(0);
    expect(money(NaN)).toBe(0);
  });

  it("uses Decimal.toNumber when present", () => {
    expect(money({ toNumber: () => 3.14 })).toBe(3.14);
  });
});

describe("parseListPaging", () => {
  function params(q: Record<string, string>) {
    const sp = new URLSearchParams(q);
    return { get: (k: string) => sp.get(k) };
  }

  it("defaults to the given page size when limit is omitted", () => {
    expect(parseListPaging(params({}), 10)).toEqual({ page: 1, take: 10, skip: 0 });
  });

  it("caps limit=all", () => {
    expect(parseListPaging(params({ limit: "all" }), 10).take).toBe(MAX_LIST_PAGE_SIZE);
  });

  it("caps oversized numeric limits", () => {
    expect(parseListPaging(params({ limit: "99999" }), 10).take).toBe(MAX_LIST_PAGE_SIZE);
  });

  it("computes skip from page", () => {
    expect(parseListPaging(params({ page: "3", limit: "25" }), 10)).toEqual({
      page: 3,
      take: 25,
      skip: 50,
    });
  });
});
