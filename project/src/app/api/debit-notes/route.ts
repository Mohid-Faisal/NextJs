import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to get account IDs
async function getAccountIds() {
  try {
    // Get Vendor Expense account (usually in Expense category)
    const vendorExpenseAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Expense",
        accountName: { contains: "Vendor", mode: "insensitive" }
      }
    });

    // Get Cash account (usually in Asset category)
    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Asset",
        accountName: { contains: "Cash", mode: "insensitive" }
      }
    });

    return {
      vendorExpenseId: vendorExpenseAccount?.id || 1, // Fallback to ID 1
      cashId: cashAccount?.id || 2 // Fallback to ID 2
    };
  } catch (error) {
    console.error("Error getting account IDs:", error);
    return { vendorExpenseId: 1, cashId: 2 }; // Default fallback
  }
}

// GET /api/debit-notes - Get all debit notes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = searchParams.get("limit") || "10";
    const search = searchParams.get("search") || "";

    const vendorId = searchParams.get("vendorId") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const pageSize = limit === "all" ? undefined : parseInt(limit);
    const skip = pageSize ? (page - 1) * pageSize : 0;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { debitNoteNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { vendor: { PersonName: { contains: search, mode: "insensitive" } } },
        { vendor: { CompanyName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (vendorId) {
      where.vendorId = parseInt(vendorId);
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortField === "vendor") {
      orderBy.vendor = { PersonName: sortOrder };
    } else if (sortField === "bill") {
      orderBy.bill = { invoiceNumber: sortOrder };
    } else if (sortField === "debitNoteNumber") {
      orderBy.debitNoteNumber = sortOrder;
    } else {
      orderBy[sortField] = sortOrder;
    }

    // Get debit notes with vendor and bill information
    const debitNotes = await prisma.debitNote.findMany({
      where,
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
      orderBy,
      skip,
      take: pageSize,
    });

    // Get total count for pagination
    const total = await prisma.debitNote.count({ where });

    return NextResponse.json({
      debitNotes,
      total,
      page,
      pageSize: pageSize || total,
      totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
    });
  } catch (error) {
    console.error("Error fetching debit notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch debit notes" },
      { status: 500 }
    );
  }
}

// POST /api/debit-notes - Create a new debit note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { billId, vendorId, amount, date, description, currency = "USD" } = body;

    // Validate required fields
    if (!vendorId || !amount || !date) {
      return NextResponse.json(
        { error: "Vendor, amount, and date are required" },
        { status: 400 }
      );
    }

    // Get account IDs for journal entries
    const { vendorExpenseId, cashId } = await getAccountIds();

    // Generate debit note number
    const lastDebitNote = await prisma.debitNote.findFirst({
      orderBy: { id: "desc" },
    });

    const nextId = (lastDebitNote?.id || 0) + 1;
    const debitNoteNumber = `#DEBIT${nextId.toString().padStart(5, "0")}`;

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the debit note
      const debitNote = await tx.debitNote.create({
        data: {
          debitNoteNumber,
          billId: billId ? parseInt(billId) : null,
          vendorId: parseInt(vendorId),
          amount: parseFloat(amount),
          date: new Date(date),
          description,
          currency,
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

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          transactionType: "EXPENSE",
          category: "Vendor Payment",
          date: new Date(date),
          amount: parseFloat(amount),
          fromPartyType: "US",
          fromCustomer: "Company",
          toPartyType: "VENDOR",
          toVendorId: parseInt(vendorId),
          toVendor: "Vendor",
          mode: "CASH",
          reference: debitNoteNumber,
          invoice: billId ? `Bill ${billId}` : undefined,
          description: `Debit Note: ${description || debitNoteNumber}`,
        },
      });

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          date: new Date(date),
          description: `Debit Note: ${description || debitNoteNumber}`,
          reference: debitNoteNumber,
          totalDebit: parseFloat(amount),
          totalCredit: parseFloat(amount),
          isPosted: true,
          postedAt: new Date(),
        },
      });

      // Create journal entry lines
      // Debit: Vendor Expense Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: vendorExpenseId,
          debitAmount: parseFloat(amount),
          creditAmount: 0,
          description: `Debit Note: ${description || debitNoteNumber}`,
          reference: debitNoteNumber,
        },
      });

      // Credit: Cash Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: cashId,
          debitAmount: 0,
          creditAmount: parseFloat(amount),
          description: `Debit Note: ${description || debitNoteNumber}`,
          reference: debitNoteNumber,
        },
      });

      // Create vendor transaction (debit)
      await tx.vendorTransaction.create({
        data: {
          vendorId: parseInt(vendorId),
          type: "DEBIT",
          amount: parseFloat(amount),
          description: `Debit Note: ${description || debitNoteNumber}`,
          reference: debitNoteNumber,
          invoice: billId ? `Bill ${billId}` : undefined,
          previousBalance: 0, // Will be calculated by the system
          newBalance: 0, // Will be calculated by the system
        },
      });

      return { debitNote, payment, journalEntry };
    });

    return NextResponse.json(result.debitNote, { status: 201 });
  } catch (error) {
    console.error("Error creating debit note:", error);
    return NextResponse.json(
      { error: "Failed to create debit note" },
      { status: 500 }
    );
  }
}
