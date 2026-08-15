export type HsCodeItem = {
  id?: number;
  code: string;
  description: string;
  category?: string;
  isActive?: boolean;
};

/**
 * Matches a free-text item/package description against the catalog of HS codes.
 * Returns the matching HS code string, or an empty string if no match is found.
 */
export function matchHsCode(
  description: string | null | undefined,
  hsCodes: HsCodeItem[]
): string {
  if (!description || !hsCodes || hsCodes.length === 0) return "";
  const cleanDesc = description.trim().toLowerCase();
  if (!cleanDesc) return "";

  // 1. Exact match (case-insensitive)
  const exact = hsCodes.find(
    (h) => h.description && h.description.trim().toLowerCase() === cleanDesc
  );
  if (exact) return exact.code;

  // 2. Substring match (either cleanDesc contains HS description or vice versa)
  const contains = hsCodes.find(
    (h) =>
      h.description &&
      (cleanDesc.includes(h.description.trim().toLowerCase()) ||
        h.description.trim().toLowerCase().includes(cleanDesc))
  );
  if (contains) return contains.code;

  // 3. Token-based word matching
  const descWords = cleanDesc.split(/\s+/).filter((w) => w.length > 1);
  if (descWords.length > 0) {
    let bestMatch: HsCodeItem | null = null;
    let maxMatchedWords = 0;

    for (const h of hsCodes) {
      if (!h.description) continue;
      const hWords = h.description.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1);
      const matched = descWords.filter((w) => hWords.includes(w)).length;
      if (matched > maxMatchedWords && matched >= Math.min(descWords.length, hWords.length)) {
        maxMatchedWords = matched;
        bestMatch = h;
      }
    }

    if (bestMatch) return bestMatch.code;
  }

  return "";
}
