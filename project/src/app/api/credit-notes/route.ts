import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { addCustomerTransaction} from "@/lib/utils";

const prisma = new PrismaClient();

// Helper function to get account IDs
async function getAccountIds() {
  try {
    // Get Cash account (usually in Asset category)
    let cashAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Asset",
        accountName: { contains: "Cash", mode: "insensitive" }
      }
    });
    if (!cashAccount) {
      cashAccount = await prisma.chartOfAccount.findFirst({ where: { category: "Asset" } });
    }

    // Get Logistic Service Revenue account (usually in Revenue category)
    let revenueAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Revenue",
        accountName: { contains: "Logistic", mode: "insensitive" }
      }
    });
    if (!revenueAccount) {
      revenueAccount = await prisma.chartOfAccount.findFirst({ where: { category: "Revenue" } });
    }

    // Get Other Expense account (usually in Expense category)
    let expenseAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Expense",
        accountName: { contains: "Other Expense", mode: "insensitive" }
      }
    });
    if (!expenseAccount) {
      expenseAccount = await prisma.chartOfAccount.findFirst({ where: { category: "Expense" } });
    }

    if (!cashAccount || !revenueAccount || !expenseAccount) {
      throw new Error(
        "Required accounts not found. Please ensure at least one Asset (Cash), one Revenue, and one Expense account exist."
      );
    }

    return {
      cashId: cashAccount.id,
      revenueId: revenueAccount.id,
      expenseId: expenseAccount.id
    };
  } catch (error) {
    console.error("Error getting account IDs:", error);
    throw error;
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

    // Attach a computed type field for UI consumption
    const withType = creditNotes.map((cn: any) => ({
      ...cn,
      type:
        typeof cn.description === "string" && cn.description.toLowerCase().startsWith("debit note")
          ? "DEBIT"
          : "CREDIT",
    }));

    // Get total count for pagination
    const total = await prisma.creditNote.count({ where });

    return NextResponse.json({
      creditNotes: withType,
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
    const { invoiceNumber, customerId, amount, date, description, currency = "PKR", type, debitAccountId, creditAccountId } = body;

    // Resolve invoiceNumber to invoiceId (nullable)
    let resolvedInvoiceId: number | null = null;
    if (invoiceNumber) {
      const found = await prisma.invoice.findFirst({
        where: { invoiceNumber: String(invoiceNumber) },
        select: { id: true },
      });
      resolvedInvoiceId = found ? found.id : null;
    }

    // Validate required fields
    if (!customerId || !amount || !date) {
      return NextResponse.json(
        { error: "Customer, amount, and date are required" },
        { status: 400 }
      );
    }

    // Get account IDs for journal entries - use provided IDs or fall back to defaults
    let cashId: number, revenueId: number, expenseId: number;
    let useProvidedAccounts = false;
    
    if (debitAccountId && creditAccountId) {
      // Validate accounts exist
      const [debitAccount, creditAccount] = await Promise.all([
        prisma.chartOfAccount.findUnique({ where: { id: parseInt(debitAccountId) } }),
        prisma.chartOfAccount.findUnique({ where: { id: parseInt(creditAccountId) } })
      ]);
      
      if (!debitAccount || !creditAccount) {
        return NextResponse.json(
          { error: "Invalid account IDs provided" },
          { status: 400 }
        );
      }
      useProvidedAccounts = true;
    } else {
      // Fall back to default account lookup
      try {
        const ids = await getAccountIds();
        cashId = ids.cashId; revenueId = ids.revenueId; expenseId = ids.expenseId;
      } catch (e: any) {
        return NextResponse.json(
          { error: e?.message || "Required accounts missing. Please configure Chart of Accounts." },
          { status: 400 }
        );
      }
    }

    // Generate credit note number
    const lastCreditNote = await prisma.creditNote.findFirst({
      orderBy: { id: "desc" },
    });

    const nextId = (lastCreditNote?.id || 0) + 1;
    const creditNoteNumber = `#CREDIT${nextId.toString().padStart(5, "0")}`;

    if (type === "DEBIT") {

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: resolvedInvoiceId,
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
          invoice: invoiceNumber ? `Invoice ${invoiceNumber}` : undefined,
          description: `Credit Note: ${description || creditNoteNumber}`,
        },
      });

      // Create journal entry
      const journalEntryDate = new Date(date);
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          date: journalEntryDate,
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
          totalDebit: parseFloat(amount),
          totalCredit: parseFloat(amount),
          isPosted: true,
          postedAt: journalEntryDate,
        },
      });

      // Create journal entry lines
      // Use provided account IDs or defaults
      const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : cashId;
      const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : revenueId;
      
      // Debit Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: debitAccId,
          debitAmount: parseFloat(amount),
          creditAmount: 0,
          description: `Credit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Credit Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: creditAccId,
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
        invoiceNumber ? invoiceNumber : undefined,
        new Date(date)
      );

      return { creditNote, payment, journalEntry };
    });

    return NextResponse.json(result.creditNote, { status: 201 });
  }
  else if (type === "CREDIT") {
    
    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: resolvedInvoiceId,
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
          invoice: invoiceNumber ? `Invoice ${invoiceNumber}` : undefined,
          description: `Debit Note: ${description || creditNoteNumber}`,
        },
      });

      // Create journal entry
      const journalEntryDate = new Date(date);
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}`,
          date: journalEntryDate,
          description: `Debit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
          totalDebit: Math.abs(parseFloat(amount)),
          totalCredit: Math.abs(parseFloat(amount)),
          isPosted: true,
          postedAt: journalEntryDate,
        },
      });

      // Create journal entry lines for negative amount
      // Use provided account IDs or defaults
      const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : expenseId;
      const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : cashId;
      
      // Debit Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: debitAccId,
          debitAmount: Math.abs(parseFloat(amount)),
          creditAmount: 0,
          description: `Debit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Credit Account
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          accountId: creditAccId,
          debitAmount: 0,
          creditAmount: Math.abs(parseFloat(amount)),
          description: `Debit Note: ${description || creditNoteNumber}`,
          reference: creditNoteNumber,
        },
      });

      // Create customer transaction (debit)
      await addCustomerTransaction(
        tx,
        parseInt(customerId),
        "DEBIT",
        parseFloat(amount),
        `Debit Note: ${description || creditNoteNumber}`,
        creditNoteNumber,
        invoiceNumber ? invoiceNumber : undefined,
        new Date(date)
      );

      return { creditNote, payment, journalEntry };
    });

    return NextResponse.json(result.creditNote, { status: 201 });
  }
  else {
    return NextResponse.json(
      { error: "Invalid type" },
      { status: 400 }
    );
  }
  } catch (error) {
    console.error("Error creating credit note:", error);
    return NextResponse.json(
      { error: "Failed to create credit note" },
      { status: 500 }
    );
  }
}
