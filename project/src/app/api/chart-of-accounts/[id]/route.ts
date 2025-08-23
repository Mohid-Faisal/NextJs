import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    
    if (isNaN(idNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid account ID" },
        { status: 400 }
      );
    }

    const account = await prisma.chartOfAccount.findUnique({
      where: { id: idNum }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account
    });
  } catch (error) {
    console.error("Error fetching account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch account" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    
    if (isNaN(idNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid account ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { accountName, category, type, debitRule, creditRule, description, isActive } = body;

    // Check if account exists
    const existingAccount = await prisma.chartOfAccount.findUnique({
      where: { id: idNum }
    });

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Update account
    const updatedAccount = await prisma.chartOfAccount.update({
      where: { id: idNum },
      data: {
        accountName: accountName || existingAccount.accountName,
        category: category || existingAccount.category,
        type: type || existingAccount.type,
        debitRule: debitRule !== undefined ? debitRule : existingAccount.debitRule,
        creditRule: creditRule !== undefined ? creditRule : existingAccount.creditRule,
        description: description !== undefined ? description : existingAccount.description,
        isActive: isActive !== undefined ? isActive : existingAccount.isActive
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: "Account updated successfully"
    });
  } catch (error) {
    console.error("Error updating account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update account" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idNum = parseInt(id);
    
    if (isNaN(idNum)) {
      return NextResponse.json(
        { success: false, error: "Invalid account ID" },
        { status: 400 }
      );
    }

    // Check if account exists
    const existingAccount = await prisma.chartOfAccount.findUnique({
      where: { id: idNum }
    });

    if (!existingAccount) {
      return NextResponse.json(
        { success: false, error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if account has any journal entries
    const journalEntries = await prisma.journalEntryLine.count({
      where: { accountId: idNum }
    });

    if (journalEntries > 0) {
      return NextResponse.json(
        { success: false, error: "Cannot delete account with existing journal entries" },
        { status: 400 }
      );
    }

    // Delete account
    await prisma.chartOfAccount.delete({
      where: { id: idNum }
    });

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
