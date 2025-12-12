import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PUT /api/debit-notes/[id] - Update a debit note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    const body = await request.json();
    const { amount, date, description } = body;

    // Update the debit note
    const updatedDebitNote = await prisma.debitNote.update({
      where: { id: idNum },
      data: {
        ...(amount && { amount: parseFloat(amount) }),
        ...(date && { date: new Date(date) }),
        ...(description && { description }),
      },
      include: {
        vendor: {
          select: {
            id: true,
            PersonName: true,
            CompanyName: true,
          },
        },
        bill: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
    });

    return NextResponse.json(updatedDebitNote);
  } catch (error) {
    console.error("Error updating debit note:", error);
    return NextResponse.json(
      { error: "Failed to update debit note" },
      { status: 500 }
    );
  }
}

// DELETE /api/debit-notes/[id] - Delete a debit note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);

    // Find the debit note to get its reference number
    const debitNote = await prisma.debitNote.findUnique({
      where: { id: idNum },
    });

    if (!debitNote) {
      return NextResponse.json(
        { error: "Debit note not found" },
        { status: 404 }
      );
    }

    // Use transaction to delete debit note and related records
    await prisma.$transaction(async (tx) => {
      // Find and delete related journal entries
      const journalEntries = await tx.journalEntry.findMany({
        where: {
          OR: [
            { reference: debitNote.debitNoteNumber },
            { description: { contains: debitNote.debitNoteNumber } }
          ]
        },
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
        where: { reference: debitNote.debitNoteNumber }
      });

      // Delete vendor transactions
      await tx.vendorTransaction.deleteMany({
        where: { reference: debitNote.debitNoteNumber }
      });

      // Finally, delete the debit note
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
