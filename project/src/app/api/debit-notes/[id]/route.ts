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

    await prisma.debitNote.delete({
      where: { id: idNum },
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
