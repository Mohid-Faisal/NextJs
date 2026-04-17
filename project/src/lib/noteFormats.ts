/** Short display reference, e.g. `#Cr0033` (Cr + 4-digit sequence) */
export function formatCreditNoteReference(seq: number): string {
  return `#Cr${seq.toString().padStart(4, "0")}`;
}

/** Short display reference, e.g. `#Db0042` */
export function formatDebitNoteReference(seq: number): string {
  return `#Db${seq.toString().padStart(4, "0")}`;
}

/**
 * Single clean ledger line: `Credit Note: …` or `Debit Note: …`.
 * Strips chains of duplicated "Credit Note:" / "Debit Note:" from body (dialog + API used to double-prefix).
 */
export function normalizeNoteLineDescription(
  kind: "credit" | "debit",
  bodyDescription: string | undefined,
  shortRef: string
): string {
  const label = kind === "credit" ? "Credit Note" : "Debit Note";
  let t = (bodyDescription ?? "").trim();
  if (!t) return `${label}: ${shortRef}`;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/^(Credit Note|Debit Note)\s*:\s*/i, "").trim();
  }
  const detail = t || shortRef;
  return `${label}: ${detail}`;
}
