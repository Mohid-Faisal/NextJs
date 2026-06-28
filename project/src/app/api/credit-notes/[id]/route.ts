import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractNoteDetailDescription,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgCreditNote } from "@/lib/tenant/findOrgCreditNote";
import { findOrgChartAccount } from "@/lib/tenant/findOrgChartAccount";

// GET /api/credit-notes/[id] — load one note for editing
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (Number.isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const note = await findOrgCreditNote(session, idNum, {
      customer: {
        select: { id: true, PersonName: true, CompanyName: true },
      },
      invoice: {
        select: { id: true, invoiceNumber: true, totalAmount: true },
      },
    });

    if (!note) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    const journalEntry = await prisma.journalEntry.findFirst({
      where: orgWhere(session, {
        OR: [
          { reference: note.creditNoteNumber },
          { description: { contains: note.creditNoteNumber } },
        ],
      }),
      include: { lines: true },
    });

    let debitAccountId: number | null = null;
    let creditAccountId: number | null = null;
    if (journalEntry?.lines?.length) {
      const debitLine = journalEntry.lines.find((l) => Number(l.debitAmount) > 0);
      const creditLine = journalEntry.lines.find((l) => Number(l.creditAmount) > 0);
      debitAccountId = debitLine?.accountId ?? null;
      creditAccountId = creditLine?.accountId ?? null;
    }

    const type: "DEBIT" | "CREDIT" =
      typeof note.description === "string" &&
      note.description.toLowerCase().startsWith("debit note")
        ? "DEBIT"
        : "CREDIT";

    const kind = type === "DEBIT" ? "debit" : "credit";

    return NextResponse.json({
      id: note.id,
      creditNoteNumber: note.creditNoteNumber,
      invoiceId: note.invoiceId,
      invoiceNumber: note.invoice?.invoiceNumber ?? null,
      customerId: note.customerId,
      amount: note.amount,
      date: note.date.toISOString(),
      description: note.description,
      descriptionDetail: extractNoteDetailDescription(note.description),
      currency: note.currency,
      type,
      kind,
      debitAccountId,
      creditAccountId,
      customer: note.customer,
      invoice: note.invoice,
    });
  } catch (error) {
    console.error("Error fetching credit note:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit note" },
      { status: 500 }
    );
  }
}

// PUT /api/credit-notes/[id] — update note and linked ledger rows
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (Number.isNaN(idNum)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json();
    const {
      amount: amountRaw,
      date: dateRaw,
      description: descriptionRaw,
      debitAccountId: debitAccRaw,
      creditAccountId: creditAccRaw,
    } = body;

    const note = await findOrgCreditNote(session, idNum, {
      invoice: { select: { invoiceNumber: true } },
    });

    if (!note) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    if (note.customerId == null) {
      return NextResponse.json(
        { error: "Credit note has no customer" },
        { status: 400 }
      );
    }
    const customerId = note.customerId;

    const type: "DEBIT" | "CREDIT" =
      typeof note.description === "string" &&
      note.description.toLowerCase().startsWith("debit note")
        ? "DEBIT"
        : "CREDIT";
    const kind = type === "DEBIT" ? "debit" : "credit";

    const oldAmount = Number(note.amount);
    const newAmount =
      amountRaw !== undefined && amountRaw !== null && amountRaw !== ""
        ? Math.abs(parseFloat(String(amountRaw)))
        : oldAmount;

    if (Number.isNaN(newAmount) || newAmount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const newDate =
      dateRaw !== undefined && dateRaw !== null && dateRaw !== ""
        ? parseDateInputAsLocalDate(dateRaw)
        : note.date;

    const lineDesc = normalizeNoteLineDescription(
      kind,
      descriptionRaw !== undefined ? String(descriptionRaw) : note.description ?? "",
      note.creditNoteNumber
    );

    const debitAccountId =
      debitAccRaw !== undefined && debitAccRaw !== null && debitAccRaw !== ""
        ? parseInt(String(debitAccRaw), 10)
        : null;
    const creditAccountId =
      creditAccRaw !== undefined && creditAccRaw !== null && creditAccRaw !== ""
        ? parseInt(String(creditAccRaw), 10)
        : null;

    if (debitAccountId !== null && creditAccountId !== null) {
      const [da, ca] = await Promise.all([
        findOrgChartAccount(session, debitAccountId),
        findOrgChartAccount(session, creditAccountId),
      ]);
      if (!da || !ca) {
        return NextResponse.json({ error: "Invalid account IDs" }, { status: 400 });
      }
    }

    const amountDelta = newAmount - oldAmount;

    await prisma.$transaction(async (tx) => {
      const txn = await tx.customerTransaction.findFirst({
        where: orgWhere(session, {
          reference: note.creditNoteNumber,
          customerId,
        }),
      });

      if (amountDelta !== 0) {
        const cust = await tx.customers.findFirst({
          where: orgWhere(session, { id: customerId }),
        });
        if (cust) {
          if (txn?.type === "CREDIT") {
            await tx.customers.update({
              where: { id: customerId },
              data: { currentBalance: cust.currentBalance + amountDelta },
            });
          } else if (txn?.type === "DEBIT") {
            await tx.customers.update({
              where: { id: customerId },
              data: { currentBalance: cust.currentBalance - amountDelta },
            });
          }
        }
      }

      await tx.creditNote.update({
        where: { id: idNum },
        data: {
          amount: newAmount,
          date: newDate,
          description: lineDesc,
        },
      });

      await tx.payment.updateMany({
        where: orgWhere(session, { reference: note.creditNoteNumber }),
        data: {
          amount: newAmount,
          date: newDate,
          description: lineDesc,
        },
      });

      const journalEntry = await tx.journalEntry.findFirst({
        where: orgWhere(session, {
          OR: [
            { reference: note.creditNoteNumber },
            { description: { contains: note.creditNoteNumber } },
          ],
        }),
        include: { lines: true },
      });

      if (journalEntry) {
        await tx.journalEntry.update({
          where: { id: journalEntry.id },
          data: {
            date: newDate,
            description: lineDesc,
            totalDebit: newAmount,
            totalCredit: newAmount,
            postedAt: newDate,
          },
        });

        for (const line of journalEntry.lines) {
          const isDebit = Number(line.debitAmount) > 0;
          const accId = isDebit ? debitAccountId : creditAccountId;
          await tx.journalEntryLine.update({
            where: { id: line.id },
            data: {
              ...(accId !== null ? { accountId: accId } : {}),
              debitAmount: isDebit ? newAmount : 0,
              creditAmount: isDebit ? 0 : newAmount,
              description: lineDesc,
            },
          });
        }
      }

      if (txn) {
        await tx.customerTransaction.update({
          where: { id: txn.id },
          data: {
            amount: newAmount,
            description: lineDesc,
            createdAt: newDate,
          },
        });
      }
    });

    const updated = await findOrgCreditNote(session, idNum, {
      customer: {
        select: { id: true, PersonName: true, CompanyName: true },
      },
      invoice: {
        select: { id: true, invoiceNumber: true, totalAmount: true },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating credit note:", error);
    return NextResponse.json(
      { error: "Failed to update credit note" },
      { status: 500 }
    );
  }
}

// DELETE /api/credit-notes/[id] - Delete a credit note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const { id } = await params;
    const idNum = parseInt(id);

    const creditNote = await findOrgCreditNote(session, idNum);

    if (!creditNote) {
      return NextResponse.json(
        { error: "Credit note not found" },
        { status: 404 }
      );
    }

    // Use transaction to delete credit note and related records
    await prisma.$transaction(async (tx) => {
      // Find and delete related journal entries
      const journalEntries = await tx.journalEntry.findMany({
        where: orgWhere(session, {
          OR: [
            { reference: creditNote.creditNoteNumber },
            { description: { contains: creditNote.creditNoteNumber } }
          ]
        }),
        include: { lines: true }
      });

      // Delete journal entry lines first (due to foreign key constraints)
      for (const entry of journalEntries) {
        if (entry.lines.length > 0) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: entry.id }
          });
        }
      }

      // Delete journal entries
      if (journalEntries.length > 0) {
        await tx.journalEntry.deleteMany({
          where: {
            id: { in: journalEntries.map(e => e.id) }
          }
        });
      }

      // Delete related payments
      await tx.payment.deleteMany({
        where: orgWhere(session, { reference: creditNote.creditNoteNumber }),
      });

      await tx.customerTransaction.deleteMany({
        where: orgWhere(session, { reference: creditNote.creditNoteNumber }),
      });

      // Finally, delete the credit note
      await tx.creditNote.delete({
        where: { id: idNum },
      });
    });

    return NextResponse.json({ message: "Credit note deleted successfully" });
  } catch (error) {
    console.error("Error deleting credit note:", error);
    return NextResponse.json(
      { error: "Failed to delete credit note" },
      { status: 500 }
    );
  }
}
