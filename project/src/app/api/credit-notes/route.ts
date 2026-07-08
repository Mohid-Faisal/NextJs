import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addCustomerTransaction } from "@/lib/utils";
import {
  formatCreditNoteReference,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requireApiSession } from "@/lib/auth/requireApiSession";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { creditNoteOrgFilter } from "@/lib/tenant/findOrgCreditNote";
import { findOrgChartAccount, findOrgChartAccountByFilter } from "@/lib/tenant/findOrgChartAccount";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";
import type { SessionPayload } from "@/lib/auth/session";

async function getAccountIds(session: SessionPayload) {
  try {
    let cashAccount = await findOrgChartAccountByFilter(session, {
      category: "Asset",
      accountName: { contains: "Cash"},
    });
    if (!cashAccount) {
      cashAccount = await findOrgChartAccountByFilter(session, { category: "Asset" });
    }

    let revenueAccount = await findOrgChartAccountByFilter(session, {
      category: "Revenue",
      accountName: { contains: "Logistic"},
    });
    if (!revenueAccount) {
      revenueAccount = await findOrgChartAccountByFilter(session, { category: "Revenue" });
    }

    let expenseAccount = await findOrgChartAccountByFilter(session, {
      category: "Expense",
      accountName: { contains: "Other Expense"},
    });
    if (!expenseAccount) {
      expenseAccount = await findOrgChartAccountByFilter(session, { category: "Expense" });
    }

    if (!cashAccount || !revenueAccount || !expenseAccount) {
      throw new Error(
        "Required accounts not found. Please ensure at least one Asset (Cash), one Revenue, and one Expense account exist."
      );
    }

    return {
      cashId: cashAccount.id,
      revenueId: revenueAccount.id,
      expenseId: expenseAccount.id,
    };
  } catch (error) {
    console.error("Error getting account IDs:", error);
    throw error;
  }
}

// GET /api/credit-notes - Get all credit notes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

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
    const where: any = { ...creditNoteOrgFilter(session) };
    
    if (search) {
      where.OR = [
        { creditNoteNumber: { contains: search} },
        { description: { contains: search} },
        { customer: { PersonName: { contains: search} } },
        { customer: { CompanyName: { contains: search} } },
      ];
    }

    if (customerId) {
      const cust = await prisma.customers.findFirst({
        where: orgWhere(session, { id: parseInt(customerId, 10) }),
      });
      if (!cust) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      where.customerId = parseInt(customerId, 10);
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

    // Get total amount sum
    const sumResult = await prisma.creditNote.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });
    const totalAmount = sumResult._sum.amount ?? 0;

    return NextResponse.json({
      creditNotes: withType,
      total,
      totalAmount,
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
    const auth = await requireApiSession(request);
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await request.json();
    const { invoiceNumber, customerId, amount, date, description, currency = "PKR", type, debitAccountId, creditAccountId } = body;

    const customer = await prisma.customers.findFirst({
      where: orgWhere(session, { id: parseInt(String(customerId), 10) }),
    });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    let resolvedInvoiceId: number | null = null;
    if (invoiceNumber) {
      const found = await prisma.invoice.findFirst({
        where: orgWhere(session, { invoiceNumber: String(invoiceNumber) }),
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
      const [debitAccount, creditAccount] = await Promise.all([
        findOrgChartAccount(session, parseInt(debitAccountId)),
        findOrgChartAccount(session, parseInt(creditAccountId)),
      ]);
      
      if (!debitAccount || !creditAccount) {
        return NextResponse.json(
          { error: "Invalid account IDs provided" },
          { status: 400 }
        );
      }
      useProvidedAccounts = true;
    } else {
      try {
        const ids = await getAccountIds(session);
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
    const creditNoteNumber = formatCreditNoteReference(nextId);

    const nextEntryNumber = await nextJournalEntryNumber(prisma, session.organizationId);

    // Must match UI: type CREDIT = credit note (customer CREDIT); type DEBIT = debit note (customer DEBIT)
    if (type === "CREDIT") {

    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      const lineDesc = normalizeNoteLineDescription(
        "credit",
        description,
        creditNoteNumber
      );
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: resolvedInvoiceId,
          customerId: parseInt(customerId),
          amount: parseFloat(amount),
          date: parseDateInputAsLocalDate(date),
          description: lineDesc,
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
        data: orgData(session, {
          transactionType: "INCOME",
          category: "Customer Credit",
          date: parseDateInputAsLocalDate(date),
          amount: parseFloat(amount),
          fromPartyType: "CUSTOMER",
          fromCustomer: "Customer",
          toPartyType: "US",
          toVendor: "Company",
          mode: "CASH",
          reference: creditNoteNumber,
          invoice: invoiceNumber ? `Invoice ${invoiceNumber}` : undefined,
          description: lineDesc,
        }),
      });

      // Create journal entry
      const journalEntryDate = parseDateInputAsLocalDate(date);
      const journalEntry = await tx.journalEntry.create({
        data: {
          organizationId: session.organizationId,
          entryNumber: nextEntryNumber,
          date: journalEntryDate,
          description: lineDesc,
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
          description: lineDesc,
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
          description: lineDesc,
          reference: creditNoteNumber,
        },
      });

      // Create customer transaction (credit)
      await addCustomerTransaction(
        tx,
        parseInt(customerId),
        "CREDIT",
        parseFloat(amount),
        lineDesc,
        creditNoteNumber,
        invoiceNumber ? invoiceNumber : undefined,
        parseDateInputAsLocalDate(date),
        session.organizationId
      );

      return { creditNote, payment, journalEntry };
    });

    return NextResponse.json(result.creditNote, { status: 201 });
  }
  else if (type === "DEBIT") {
    
    // Use transaction to ensure all operations succeed or fail together
    const result = await prisma.$transaction(async (tx) => {
      const lineDesc = normalizeNoteLineDescription(
        "debit",
        description,
        creditNoteNumber
      );
      // Create the credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: resolvedInvoiceId,
          customerId: parseInt(customerId),
          amount: parseFloat(amount),
          date: parseDateInputAsLocalDate(date),
          description: lineDesc,
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
        data: orgData(session, {
          transactionType: "EXPENSE",
          category: "Customer Credit",
          date: parseDateInputAsLocalDate(date),
          amount: Math.abs(parseFloat(amount)),
          fromPartyType: "CUSTOMER",
          fromCustomer: "Customer",
          toPartyType: "US",
          toVendor: "Company",
          mode: "CASH",
          reference: creditNoteNumber,
          invoice: invoiceNumber ? `Invoice ${invoiceNumber}` : undefined,
          description: lineDesc,
        }),
      });

      // Create journal entry
      const journalEntryDate = parseDateInputAsLocalDate(date);
      const journalEntry = await tx.journalEntry.create({
        data: {
          organizationId: session.organizationId,
          entryNumber: nextEntryNumber,
          date: journalEntryDate,
          description: lineDesc,
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
          description: lineDesc,
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
          description: lineDesc,
          reference: creditNoteNumber,
        },
      });

      // Create customer transaction (debit)
      await addCustomerTransaction(
        tx,
        parseInt(customerId),
        "DEBIT",
        parseFloat(amount),
        lineDesc,
        creditNoteNumber,
        invoiceNumber ? invoiceNumber : undefined,
        parseDateInputAsLocalDate(date),
        session.organizationId
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
