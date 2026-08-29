import { nextJournalEntryNumber } from "@/lib/sequences";

/**
 * Next JE number scoped to one org — now backed by the atomic OrgSequence
 * counter (see lib/sequences.ts). Kept as a re-export so all existing call
 * sites get collision-free numbering without individual changes.
 */
export { nextJournalEntryNumber };
