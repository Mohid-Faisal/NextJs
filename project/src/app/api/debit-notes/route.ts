import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { addVendorTransaction } from "@/lib/utils";

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

    // Get Other Income account (usually in Revenue category)
    const otherIncomeAccount = await prisma.chartOfAccount.findFirst({
      where: {
        category: "Revenue",
        accountName: { contains: "Other Revenue", mode: "insensitive" }
      }
    });

    return {
      vendorExpenseId: vendorExpenseAccount?.id || 1, // Fallback to ID 1
      cashId: cashAccount?.id || 2, // Fallback to ID 2
      otherIncomeId: otherIncomeAccount?.id || 5 // Fallback to ID 5
    };
  } catch (error) {
    console.error("Error getting account IDs:", error);
    return { vendorExpenseId: 1, cashId: 2, otherIncomeId: 5 }; // Default fallback
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

    const withType = debitNotes.map((dn: any) => ({
      ...dn,
      type:
        typeof dn.description === "string" && dn.description.toLowerCase().startsWith("credit note")
          ? "CREDIT"
          : "DEBIT",
    }));

    // Get total count for pagination
    const total = await prisma.debitNote.count({ where });

    return NextResponse.json({
      debitNotes: withType,
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
    const { billId, vendorId, amount, date, description, currency = "USD", type, debitAccountId, creditAccountId } = body;
    console.log(body);

    // Validate required fields
    if (!vendorId || !amount || !date) {
      return NextResponse.json(
        { error: "Vendor, amount, and date are required" },
        { status: 400 }
      );
    }

    // Get account IDs for journal entries - use provided IDs or fall back to defaults
    let vendorExpenseId: number, cashId: number, otherIncomeId: number;
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
      const ids = await getAccountIds();
      vendorExpenseId = ids.vendorExpenseId;
      cashId = ids.cashId;
      otherIncomeId = ids.otherIncomeId;
    }

    // Generate debit note number
    const lastDebitNote = await prisma.debitNote.findFirst({
      orderBy: { id: "desc" },
    });

    const nextId = (lastDebitNote?.id || 0) + 1;
    const debitNoteNumber = `#DEBIT${nextId.toString().padStart(5, "0")}`;

    if (type === "CREDIT") {
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
            description: description || `Credit Note: ${debitNoteNumber}`,
          },
        });

        // Create journal entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: `JE-${Date.now()}`,
            date: new Date(date),
            description: description || `Credit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
            totalDebit: parseFloat(amount),
            totalCredit: parseFloat(amount),
            isPosted: true,
            postedAt: new Date(),
          },
        });

        // Create journal entry lines for positive amount
        // Use provided account IDs or defaults
        const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : vendorExpenseId;
        const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : cashId;
        
        // Debit Account
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: debitAccId,
            debitAmount: parseFloat(amount),
            creditAmount: 0,
            description: description || `Credit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
          },
        });

        // Credit Account
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: creditAccId,
            debitAmount: 0,
            creditAmount: parseFloat(amount),
            description: description || `Credit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
          },
        });

        // Create vendor transaction (debit)
        await addVendorTransaction(
          tx,
          parseInt(vendorId),
          "DEBIT",
          parseFloat(amount),
          description || `Credit Note: ${debitNoteNumber}`,
          debitNoteNumber,
          billId ? `Bill ${billId}` : undefined
        );

        return { debitNote, payment, journalEntry };
      });

      return NextResponse.json(result.debitNote, { status: 201 });
    } else if (type === "DEBIT") {
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
            transactionType: "INCOME",
            category: "Vendor Credit",
            date: new Date(date),
            amount: Math.abs(parseFloat(amount)), // Use absolute value for payment amount
            fromPartyType: "VENDOR",
            fromCustomer: "Vendor",
            toPartyType: "US",
            toVendor: "Company",
            mode: "CASH",
            reference: debitNoteNumber,
            invoice: billId ? `Bill ${billId}` : undefined,
            description: description || `Debit Note: ${debitNoteNumber}`,
          },
        });

        // Create journal entry
        const journalEntry = await tx.journalEntry.create({
          data: {
            entryNumber: `JE-${Date.now()}`,
            date: new Date(date),
            description: description || `Debit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
            totalDebit: Math.abs(parseFloat(amount)),
            totalCredit: Math.abs(parseFloat(amount)),
            isPosted: true,
            postedAt: new Date(),
          },
        });

        // Create journal entry lines for negative amount
        // Use provided account IDs or defaults
        const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : cashId;
        const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : otherIncomeId;
        
        // Debit Account
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: debitAccId,
            debitAmount: Math.abs(parseFloat(amount)),
            creditAmount: 0,
            description: description || `Debit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
          },
        });

        // Credit Account
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: creditAccId,
            debitAmount: 0,
            creditAmount: Math.abs(parseFloat(amount)),
            description: description || `Debit Note: ${debitNoteNumber}`,
            reference: debitNoteNumber,
          },
        });

        // Create vendor transaction (credit)
        await addVendorTransaction(
          tx,
          parseInt(vendorId),
          "CREDIT",
          parseFloat(amount),
          description || `Debit Note: ${debitNoteNumber}`,
          debitNoteNumber,
          billId ? `Bill ${billId}` : undefined
        );

        return { debitNote, payment, journalEntry };
      });

      return NextResponse.json(result.debitNote, { status: 201 });
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error creating debit note:", error);
    return NextResponse.json(
      { error: "Failed to create debit note" },
      { status: 500 }
    );
  }
}
