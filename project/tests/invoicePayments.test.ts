import { describe, expect, it } from "vitest";
import { planFifoAllocations } from "@/lib/accounts/invoicePayments";

describe("planFifoAllocations", () => {
  it("keeps one payment's cash split across invoices FIFO without inventing extra payments", () => {
    const invoices = [
      { id: 1, invoiceNumber: "600001", totalAmount: 1000 },
      { id: 2, invoiceNumber: "600002", totalAmount: 1000 },
      { id: 3, invoiceNumber: "600003", totalAmount: 1000 },
    ];
    const paid = new Map<number, number>([
      [1, 0],
      [2, 200],
      [3, 0],
    ]);
    const planned = planFifoAllocations(invoices, paid, 2500);
    expect(planned).toEqual([
      { invoiceId: 1, invoiceNumber: "600001", amount: 1000 },
      { invoiceId: 2, invoiceNumber: "600002", amount: 800 },
      { invoiceId: 3, invoiceNumber: "600003", amount: 700 },
    ]);
    expect(planned.reduce((s, p) => s + p.amount, 0)).toBe(2500);
  });

  it("stops when excess is exhausted", () => {
    const invoices = [
      { id: 1, invoiceNumber: "A", totalAmount: 100 },
      { id: 2, invoiceNumber: "B", totalAmount: 100 },
    ];
    const planned = planFifoAllocations(invoices, new Map(), 40);
    expect(planned).toEqual([{ invoiceId: 1, invoiceNumber: "A", amount: 40 }]);
  });
});
