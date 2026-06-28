import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractNoteDetailDescription,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgWhere } from "@/lib/tenant/prismaScope";
import { findOrgDebitNote } from "@/lib/tenant/findOrgDebitNote";
import { findOrgChartAccount } from "@/lib/tenant/findOrgChartAccount";

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

    const note = await findOrgDebitNote(session, idNum, {
      vendor: {
        select: { id: true, PersonName: true, CompanyName: true },
      },
      bill: {
        select: { id: true, invoiceNumber: true, totalAmount: true },
      },
    });

    if (!note) {
      return NextResponse.json({ error: "Debit note not found" }, { status: 404 });
    }

    const journalEntry = await prisma.journalEntry.findFirst({
      where: orgWhere(session, {
        OR: [
          { reference: note.debitNoteNumber },
          { description: { contains: note.debitNoteNumber } },
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
      note.description.toLowerCase().startsWith("credit note")
        ? "CREDIT"
        : "DEBIT";

    const kind = type === "CREDIT" ? "credit" : "debit";

    return NextResponse.json({
      id: note.id,
      debitNoteNumber: note.debitNoteNumber,
      billId: note.billId,
      billInvoiceNumber: note.bill?.invoiceNumber ?? null,
      vendorId: note.vendorId,
      amount: note.amount,
      date: note.date.toISOString(),
      description: note.description,
      descriptionDetail: extractNoteDetailDescription(note.description),
      currency: note.currency,
      type,
      kind,
      debitAccountId,
      creditAccountId,
      vendor: note.vendor,
      bill: note.bill,
    });
  } catch (error) {
    console.error("Error fetching debit note:", error);
    return NextResponse.json(
      { error: "Failed to fetch debit note" },
      { status: 500 }
    );
  }
}

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

    const note = await findOrgDebitNote(session, idNum, {
      bill: { select: { invoiceNumber: true } },
    });

    if (!note) {
      return NextResponse.json({ error: "Debit note not found" }, { status: 404 });
    }

    if (note.vendorId == null) {
      return NextResponse.json(
        { error: "Debit note has no vendor" },
        { status: 400 }
      );
    }
    const vendorId = note.vendorId;

    const type: "DEBIT" | "CREDIT" =
      typeof note.description === "string" &&
      note.description.toLowerCase().startsWith("credit note")
        ? "CREDIT"
        : "DEBIT";
    const kind = type === "CREDIT" ? "credit" : "debit";

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
      note.debitNoteNumber
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
      const txn = await tx.vendorTransaction.findFirst({
        where: orgWhere(session, {
          reference: note.debitNoteNumber,
          vendorId,
        }),
      });

      if (amountDelta !== 0) {
        const ven = await tx.vendors.findFirst({
          where: orgWhere(session, { id: vendorId }),
        });
        if (ven) {
          if (txn?.type === "DEBIT") {
            await tx.vendors.update({
              where: { id: vendorId },
              data: { currentBalance: ven.currentBalance + amountDelta },
            });
          } else if (txn?.type === "CREDIT") {
            await tx.vendors.update({
              where: { id: vendorId },
              data: { currentBalance: ven.currentBalance - amountDelta },
            });
          }
        }
      }

      await tx.debitNote.update({
        where: { id: idNum },
        data: {
          amount: newAmount,
          date: newDate,
          description: lineDesc,
        },
      });

      await tx.payment.updateMany({
        where: orgWhere(session, { reference: note.debitNoteNumber }),
        data: {
          amount: newAmount,
          date: newDate,
          description: lineDesc,
        },
      });

      const journalEntry = await tx.journalEntry.findFirst({
        where: orgWhere(session, {
          OR: [
            { reference: note.debitNoteNumber },
            { description: { contains: note.debitNoteNumber } },
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
        await tx.vendorTransaction.update({
          where: { id: txn.id },
          data: {
            amount: newAmount,
            description: lineDesc,
            createdAt: newDate,
          },
        });
      }
    });

    const updated = await findOrgDebitNote(session, idNum, {
      vendor: {
        select: { id: true, PersonName: true, CompanyName: true },
      },
      bill: {
        select: { id: true, invoiceNumber: true, totalAmount: true },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating debit note:", error);
    return NextResponse.json(
      { error: "Failed to update debit note" },
      { status: 500 }
    );
  }
}

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

    const debitNote = await findOrgDebitNote(session, idNum);

    if (!debitNote) {
      return NextResponse.json(
        { error: "Debit note not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const journalEntries = await tx.journalEntry.findMany({
        where: orgWhere(session, {
          OR: [
            { reference: debitNote.debitNoteNumber },
            { description: { contains: debitNote.debitNoteNumber } },
          ],
        }),
        include: { lines: true },
      });

      for (const entry of journalEntries) {
        if (entry.lines.length > 0) {
          await tx.journalEntryLine.deleteMany({
            where: { journalEntryId: entry.id },
          });
        }
      }

      if (journalEntries.length > 0) {
        await tx.journalEntry.deleteMany({
          where: {
            id: { in: journalEntries.map((e) => e.id) },
          },
        });
      }

      await tx.payment.deleteMany({
        where: orgWhere(session, { reference: debitNote.debitNoteNumber }),
      });

      await tx.vendorTransaction.deleteMany({
        where: orgWhere(session, { reference: debitNote.debitNoteNumber }),
      });

      await tx.debitNote.delete({
        where: { id: idNum },
      });
    });

    return NextResponse.json({ message: "Debit note deleted successfully" });
  } catch (error) {
    console.error("Error deleting debit note:", error);
    return NextResponse.json(
      { error: "Failed to delete debit note" },
      { status: 500 }
    );
  }
}
