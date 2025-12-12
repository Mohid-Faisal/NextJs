import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// DELETE /api/credit-notes/[id] - Delete a credit note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);

    // Find the credit note to get its reference number
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: idNum },
    });

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
        where: {
          OR: [
            { reference: creditNote.creditNoteNumber },
            { description: { contains: creditNote.creditNoteNumber } }
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
        where: { reference: creditNote.creditNoteNumber }
      });

      // Delete customer transactions
      await tx.customerTransaction.deleteMany({
        where: { reference: creditNote.creditNoteNumber }
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

