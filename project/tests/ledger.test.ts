import { describe, expect, it, vi } from "vitest";
import { updateJournalEntriesForInvoice } from "@/lib/server/ledger";

describe("updateJournalEntriesForInvoice", () => {
  it("passes newDate to customer and vendor journal updates and propagates date to transactions", async () => {
    const mockPrisma = {
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: 10,
          lines: [
            { id: 1, debitAmount: 100, creditAmount: 0 },
            { id: 2, debitAmount: 0, creditAmount: 100 },
          ],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      journalEntryLine: {
        update: vi.fn().mockResolvedValue({}),
      },
      customerTransaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      vendorTransaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const newDate = new Date("2026-08-15T00:00:00.000Z");
    const res = await updateJournalEntriesForInvoice(
      mockPrisma as any,
      1,
      100,
      150,
      2,
      2,
      3,
      3,
      "INV-001",
      "Updated invoice INV-001",
      1,
      newDate
    );

    expect(res).toEqual({ customerUpdated: true, vendorUpdated: true });
    expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalDebit: 150,
          totalCredit: 150,
          date: newDate,
          postedAt: newDate,
        }),
      })
    );
    expect(mockPrisma.customerTransaction.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 1, reference: "INV-001", type: "DEBIT" },
      data: { createdAt: newDate },
    });
    expect(mockPrisma.vendorTransaction.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 1, reference: "INV-001", type: "DEBIT" },
      data: { createdAt: newDate },
    });
  });
});
