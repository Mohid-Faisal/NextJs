/** Short display reference, e.g. `#CR0033` */
export function formatCreditNoteReference(seq: number): string {
  return `#CR${seq.toString().padStart(4, "0")}`;
}

/** Short display reference, e.g. `#DB0042` */
export function formatDebitNoteReference(seq: number): string {
  return `#DB${seq.toString().padStart(4, "0")}`;
}

/** Customer-ledger credit note refs: `#CR0001` (new), `#Cr0001` (legacy), or mistaken `#CREDIT…` */
export function isCustomerCreditNoteReference(
  ref: string | null | undefined
): boolean {
  if (!ref) return false;
  if (ref.startsWith("#CREDIT")) return true;
  return /^#cr\d+/i.test(ref);
}

/** Vendor-ledger debit note refs: `#DB0001` (new), `#Db0001` (legacy), or `#DEBIT…` */
export function isVendorDebitNoteReference(
  ref: string | null | undefined
): boolean {
  if (!ref) return false;
  if (ref.startsWith("#DEBIT")) return true;
  return /^#db\d+/i.test(ref);
}

/**
 * Parse HTML date `YYYY-MM-DD` as a local calendar day (avoids UTC midnight shifting the displayed day).
 * Falls back to `Date` parsing for ISO strings from APIs.
 */
export function parseDateInputAsLocalDate(
  input: string | Date | undefined | null
): Date {
  if (input == null || input === "") return new Date();
  if (input instanceof Date) return input;
  const s = String(input).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    return new Date(y, m, d, 12, 0, 0, 0);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return new Date();
}

/**
 * Single clean ledger line: `Adjustment: ...`.
 * Strips chains of duplicated old/new note prefixes from body.
 */
export function normalizeNoteLineDescription(
  kind: "credit" | "debit",
  bodyDescription: string | undefined,
  shortRef: string
): string {
  const label = "Adjustment";
  let t = (bodyDescription ?? "").trim();
  if (!t) return `${label}: ${shortRef}`;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/^(Credit Note|Debit Note|Adjustment)\s*:\s*/i, "").trim();
  }
  const detail = t || shortRef;
  return `${label}: ${detail}`;
}

/** Strip leading note prefixes for form fields (edit dialogs). */
export function extractNoteDetailDescription(stored: string | null | undefined): string {
  let t = (stored ?? "").trim();
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/^(Credit Note|Debit Note|Adjustment)\s*:\s*/i, "").trim();
  }
  return t;
}
