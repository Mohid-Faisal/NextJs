/** Short display reference for CREDIT adjustments, e.g. `#CR0033` */
export function formatCreditNoteReference(seq: number): string {
  return `#CR${seq.toString().padStart(4, "0")}`;
}

/** Short display reference for DEBIT adjustments, e.g. `#DR0042` (legacy `#DB…` still recognized) */
export function formatDebitNoteReference(seq: number): string {
  return `#DR${seq.toString().padStart(4, "0")}`;
}

/** Pick `#CR` / `#DR` from the entry type (CREDIT → CR, DEBIT → DR). */
export function formatAdjustmentReference(
  type: "CREDIT" | "DEBIT",
  seq: number
): string {
  return type === "DEBIT"
    ? formatDebitNoteReference(seq)
    : formatCreditNoteReference(seq);
}

/** Customer-ledger adjustment refs: `#CR…`, `#DR…`, legacy `#Cr…` / `#CREDIT…` */
export function isCustomerCreditNoteReference(
  ref: string | null | undefined
): boolean {
  if (!ref) return false;
  if (ref.startsWith("#CREDIT") || ref.startsWith("#DEBIT")) return true;
  return /^#(cr|dr)\d+/i.test(ref);
}

/** Vendor-ledger adjustment refs: `#DR…`, legacy `#DB…` / `#DEBIT…`, and `#CR…` for vendor credits */
export function isVendorDebitNoteReference(
  ref: string | null | undefined
): boolean {
  if (!ref) return false;
  if (ref.startsWith("#DEBIT") || ref.startsWith("#CREDIT")) return true;
  return /^#(dr|db|cr)\d+/i.test(ref);
}

/** Infer CREDIT/DEBIT from reference prefix when possible. */
export function inferNoteTypeFromReference(
  ref: string | null | undefined
): "CREDIT" | "DEBIT" | null {
  if (!ref) return null;
  if (/^#(dr|db)\d+/i.test(ref) || ref.startsWith("#DEBIT")) return "DEBIT";
  if (/^#cr\d+/i.test(ref) || ref.startsWith("#CREDIT")) return "CREDIT";
  return null;
}

/**
 * Infer adjustment type from reference, description, or linked ledger txn type.
 * Prefers explicit txn type (handles legacy DEBIT rows that still have `#CR` refs).
 */
export function inferAdjustmentType(opts: {
  reference?: string | null;
  description?: string | null;
  transactionType?: "CREDIT" | "DEBIT" | null;
  /** Default when nothing else matches (income page → CREDIT, expense → DEBIT) */
  fallback?: "CREDIT" | "DEBIT";
}): "CREDIT" | "DEBIT" {
  const desc = (opts.description ?? "").trim().toLowerCase();
  if (desc.startsWith("debit note")) return "DEBIT";
  if (desc.startsWith("credit note")) return "CREDIT";
  if (opts.transactionType === "CREDIT" || opts.transactionType === "DEBIT") {
    return opts.transactionType;
  }
  const fromRef = inferNoteTypeFromReference(opts.reference);
  if (fromRef) return fromRef;
  return opts.fallback ?? "CREDIT";
}

/** Lahore / Pakistan Standard Time (Asia/Karachi) is permanently UTC+05:00 (no DST). */
export const LAHORE_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Parse HTML date `YYYY-MM-DD`, datetime-local `YYYY-MM-DDTHH:mm`, or ISO string
 * using Lahore clock (`Asia/Karachi`, UTC+05:00) for timezone-less inputs.
 * Date-only values use noon Lahore time (07:00 UTC) to avoid midnight boundary shifts.
 */
export function parseDateInputAsLocalDate(
  input: string | Date | undefined | null
): Date {
  if (input == null || input === "") return new Date();
  if (input instanceof Date) return input;
  const s = String(input).trim();
  // If string already carries an explicit timezone offset (Z or ±HH:MM), preserve it as-is
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t);
  }
  const ymdHm =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      s
    );
  if (ymdHm) {
    const y = parseInt(ymdHm[1], 10);
    const m = parseInt(ymdHm[2], 10) - 1;
    const d = parseInt(ymdHm[3], 10);
    const hh = parseInt(ymdHm[4], 10);
    const mm = parseInt(ymdHm[5], 10);
    const ss = ymdHm[6] ? parseInt(ymdHm[6], 10) : 0;
    const ms = ymdHm[7] ? parseInt(ymdHm[7].padEnd(3, "0"), 10) : 0;
    return new Date(Date.UTC(y, m, d, hh - 5, mm, ss, ms));
  }
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    return new Date(Date.UTC(y, m, d, 12 - 5, 0, 0, 0));
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  return new Date();
}

/** Format a Date for `<input type="datetime-local">` in Lahore time (Asia/Karachi, UTC+05:00). */
export function toDatetimeLocalValue(input: string | Date | undefined | null): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : parseDateInputAsLocalDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const lahore = new Date(d.getTime() + LAHORE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${lahore.getUTCFullYear()}-${pad(lahore.getUTCMonth() + 1)}-${pad(lahore.getUTCDate())}T${pad(lahore.getUTCHours())}:${pad(lahore.getUTCMinutes())}`;
}

/** Format a Date for `<input type="date">` (YYYY-MM-DD) in Lahore time (Asia/Karachi, UTC+05:00). */
export function toDateInputValue(input: string | Date | undefined | null): string {
  if (input == null || input === "") return "";
  const d = input instanceof Date ? input : parseDateInputAsLocalDate(input);
  if (Number.isNaN(d.getTime())) return "";
  const lahore = new Date(d.getTime() + LAHORE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${lahore.getUTCFullYear()}-${pad(lahore.getUTCMonth() + 1)}-${pad(lahore.getUTCDate())}`;
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

/** Format shipment date for ledger description (dd/MM/yy HH:mm) in Lahore time. */
function formatShipmentDateForDesc(input: string | Date): string {
  const d = input instanceof Date ? input : parseDateInputAsLocalDate(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const lahore = new Date(d.getTime() + LAHORE_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(lahore.getUTCDate())}/${pad(lahore.getUTCMonth() + 1)}/${String(lahore.getUTCFullYear()).slice(-2)} ${pad(lahore.getUTCHours())}:${pad(lahore.getUTCMinutes())}`;
}

/**
 * Adjustment ledger description order:
 * `[Description] | Consignee: … | Tracking: … | Shipment Date: …`
 */
export function formatAdjustmentLedgerDescription(opts: {
  description: string | null | undefined;
  consigneeName?: string | null;
  trackingId?: string | null;
  shipmentDate?: string | Date | null;
}): string {
  const parts: string[] = [];
  const desc = (opts.description ?? "").trim();
  if (desc) parts.push(desc);
  const consignee = (opts.consigneeName ?? "").trim();
  if (consignee) parts.push(`Consignee: ${consignee}`);
  const tracking = (opts.trackingId ?? "").trim();
  if (tracking) parts.push(`Tracking: ${tracking}`);
  if (opts.shipmentDate) {
    parts.push(`Shipment Date: ${formatShipmentDateForDesc(opts.shipmentDate)}`);
  }
  return parts.join(" | ");
}
