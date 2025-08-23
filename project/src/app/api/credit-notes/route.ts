import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { addCustomerTransaction} from "@/lib/utils";

const prisma = new PrismaClient();

// Helper function to get account IDs
async function getAccountIds() {
  try {
    // Get Cash account (usually in Asset category)
    const cashAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Asset",
        accountName: { contains: "Cash", mode: "insensitive" }
      }
    });

    // Get Logistic Service Revenue account (usually in Revenue category)
    const revenueAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Revenue",
        accountName: { contains: "Logistic", mode: "insensitive" }
      }
    });

    // Get Other Expense account (usually in Expense category)
    const expenseAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Expense",
        accountName: { contains: "Other Expense", mode: "insensitive" }
      }
    });

    return {
      cashId: cashAccount?.id || 2, // Fallback to ID 2
      revenueId: revenueAccount?.id || 3, // Fallback to ID 3
      expenseId: expenseAccount?.id || 4 // Fallback to ID 4
    };
  } catch (error) {
    console.error("Error getting account IDs:", error);
    return { cashId: 2, revenueId: 3, expenseId: 4 }; // Default fallback
  }
}

// GET /api/credit-notes - Get all credit notes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = searchParams.get("limit") || "10";
    const search = searchParams.get("search") || "";

    const customerId = searchParams.get("customerId") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const pageSize = limit === "all" ? undefined : parseInt(limit);
    const skip = pageSize ? (page - 1) * pageSize : 0;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { customer: { PersonName: { contains: search, mode: "insensitive" } } },
        { customer: { CompanyName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    // Build order by clause
    const orderBy: any = {};
    if (sortField === "customer") {
      orderBy.customer = { PersonName: sortOrder };
    } else if (sortField === "invoice") {
      orderBy.invoice = { invoiceNumber: sortOrder };
    } else if (sortField === "creditNoteNumber") {
      orderBy.creditNoteNumber = sortOrder;
    } else {
      orderBy[sortField] = sortOrder;
    }

    // Get credit notes with customer and invoice information
    const creditNotes = await prisma.creditNote.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            PersonName: true,
            CompanyName: true,
          },
        },
        invoice: {
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
    const total = await prisma.creditNote.count({ where });

    return NextResponse.json({
      creditNotes,
      total,
      page,
      pageSize: pageSize || total,
      totalPages: pageSize ? Math.ceil(total / pageSize) : 1,
    });
  } catch (error) {
    console.error("Error fetching credit notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit notes" },
      { status: 500 }
    );
  }
}

// POST /api/credit-notes - Create a new credit note
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoiceId, customerId, amount, date, description, currency = "USD" } = body;

    // Validate required fields
    if (!customerId || !amount || !date) {
      return NextResponse.json(
        { error: "Customer, amount, and date are required" },
        { status: 400 }
      );
    }

    // Get account IDs for journal entries
    const { cashId, revenueId, expenseId } = await getAccountIds();

    // Generate credit note number
    const lastCreditNote = await prisma.creditNote.findFirst({
      orderBy: { id: "desc" },
    });

    const nextId = (lastCreditNote?.id || 0) + 1;
    const creditNoteNumber = `#CREDIT${nextId.toString().padStart(5, "0")}`;

    if (amount > 0) {

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoiceId ? parseInt(invoiceId) : null,
          customerId: parseInt(customerId),
          amount: parseFloat(amount),
          date: new Date(date),
          description,
          currency,
        },
        include: {
          customer: {
            select: {
              id: true,
              PersonName: true,
              CompanyName: true,
            },
          },
          invoice: {
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
          transactionType: "INCOME",
          category: "Customer Credit",
          date: new Date(date),
          amount: parseFloat(amount),
          fromPartyType: "CUSTOMER",
          fromCustomer: "Customer",
          toPartyType: "US",
          toVendor: "Company",
          mode: "CASH",
          reference: creditNoteNumber,
          invoice: invoiceId ? `Invoice ${invoiceId}` : undefined,
          description: `Credit Note: ${description || creditNoteNumber}`,
        },
      });

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          date: new Date(date),
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
          totalDebit: parseFloat(amount),
          totalCredit: parseFloat(amount),
          isPosted: true,
          postedAt: new Date(),
        },
      });

      // Create journal entry lines
      // Debit: Cash Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: cashId,
          debitAmount: parseFloat(amount),
          creditAmount: 0,
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Credit: Logistic Service Revenue Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: revenueId,
          debitAmount: 0,
          creditAmount: parseFloat(amount),
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Create customer transaction (credit)
      await addCustomerTransaction(
        tx,
        parseInt(customerId),
        "CREDIT",
        parseFloat(amount),
        `Credit Note: ${description || creditNoteNumber}`,
        creditNoteNumber,
        invoiceId ? `Invoice ${invoiceId}` : undefined
      );

      return { creditNote, payment, journalEntry };
    });

    return NextResponse.json(result.creditNote, { status: 201 });
  }
  else{
    
    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoiceId ? parseInt(invoiceId) : null,
          customerId: parseInt(customerId),
          amount: parseFloat(amount),
          date: new Date(date),
          description,
          currency,
        },
        include: {
          customer: {
            select: {
              id: true,
              PersonName: true,
              CompanyName: true,
            },
          },
          invoice: {
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
          category: "Customer Credit",
          date: new Date(date),
          amount: Math.abs(parseFloat(amount)), // Use absolute value for payment amount
          fromPartyType: "CUSTOMER",
          fromCustomer: "Customer",
          toPartyType: "US",
          toVendor: "Company",
          mode: "CASH",
          reference: creditNoteNumber,
          invoice: invoiceId ? `Invoice ${invoiceId}` : undefined,
          description: `Credit Note: ${description || creditNoteNumber}`,
        },
      });

      // Create journal entry
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          date: new Date(date),
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
          totalDebit: Math.abs(parseFloat(amount)),
          totalCredit: Math.abs(parseFloat(amount)),
          isPosted: true,
          postedAt: new Date(),
        },
      });

      // Create journal entry lines for negative amount
      // Debit: Other Expense Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: expenseId,
          debitAmount: Math.abs(parseFloat(amount)),
          creditAmount: 0,
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Credit: Cash Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: cashId,
          debitAmount: 0,
          creditAmount: Math.abs(parseFloat(amount)),
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Create customer transaction (debit)
      await addCustomerTransaction(
        tx,
        parseInt(customerId),
        "DEBIT",
        parseFloat(amount),
        `Credit Note: ${description || creditNoteNumber}`,
        creditNoteNumber,
        invoiceId ? `Invoice ${invoiceId}` : undefined
      );

      return { creditNote, payment, journalEntry };
    });

    return NextResponse.json(result.creditNote, { status: 201 });
  }
  } catch (error) {
    console.error("Error creating credit note:", error);
    return NextResponse.json(
      { error: "Failed to create credit note" },
      { status: 500 }
    );
  }
}
