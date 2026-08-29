import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addVendorTransaction } from "@/lib/server/ledger";
import {
  formatAdjustmentReference,
  inferAdjustmentType,
  normalizeNoteLineDescription,
  parseDateInputAsLocalDate,
} from "@/lib/noteFormats";
import { requirePermission } from "@/lib/auth/requirePermission";
import { orgData, orgWhere } from "@/lib/tenant/prismaScope";
import { debitNoteOrgFilter } from "@/lib/tenant/findOrgDebitNote";
import { findOrgChartAccount, findOrgChartAccountByFilter } from "@/lib/tenant/findOrgChartAccount";
import { nextJournalEntryNumber } from "@/lib/tenant/orgJournalChart";
import { nextSequenceNumber } from "@/lib/sequences";
import type { SessionPayload } from "@/lib/auth/session";
import { parseListPaging } from "@/lib/money";

async function getAccountIds(session: SessionPayload) {
  let vendorExpenseAccount = await findOrgChartAccountByFilter(session, {
    category: "Expense",
    accountName: { contains: "Vendor"},
  });
  if (!vendorExpenseAccount) {
    vendorExpenseAccount = await findOrgChartAccountByFilter(session, { category: "Expense" });
  }

  let cashAccount = await findOrgChartAccountByFilter(session, {
    category: "Asset",
    accountName: { contains: "Cash"},
  });
  if (!cashAccount) {
    cashAccount = await findOrgChartAccountByFilter(session, { category: "Asset" });
  }

  let otherIncomeAccount = await findOrgChartAccountByFilter(session, {
    category: "Revenue",
    accountName: { contains: "Other Revenue"},
  });
  if (!otherIncomeAccount) {
    otherIncomeAccount = await findOrgChartAccountByFilter(session, { category: "Revenue" });
  }

  if (!vendorExpenseAccount || !cashAccount || !otherIncomeAccount) {
    throw new Error(
      "Required accounts not found. Please ensure at least one Expense, Asset (Cash), and Revenue account exist in your Chart of Accounts."
    );
  }

  return {
    vendorExpenseId: vendorExpenseAccount.id,
    cashId: cashAccount.id,
    otherIncomeId: otherIncomeAccount.id,
  };
}

// GET /api/debit-notes - Get all debit notes with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "view_revenue");
    if (auth.error) return auth.error;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const { page, take: pageSize, skip } = parseListPaging(searchParams, 10);
    const search = searchParams.get("search") || "";

    const vendorId = searchParams.get("vendorId") || "";
    const sortField = searchParams.get("sortField") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    // Build where clause
    const where: any = { ...debitNoteOrgFilter(session) };
    
    if (search) {
      where.OR = [
        { debitNoteNumber: { contains: search} },
        { description: { contains: search} },
        { vendor: { PersonName: { contains: search} } },
        { vendor: { CompanyName: { contains: search} } },
      ];
    }

    if (vendorId) {
      const ven = await prisma.vendors.findFirst({
        where: orgWhere(session, { id: parseInt(vendorId, 10) }),
      });
      if (!ven) {
        return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
      }
      where.vendorId = parseInt(vendorId, 10);
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

    const noteRefs = debitNotes
      .map((dn: any) => dn.debitNoteNumber as string)
      .filter(Boolean);
    const linkedTxns =
      noteRefs.length > 0
        ? await prisma.vendorTransaction.findMany({
            where: orgWhere(session, { reference: { in: noteRefs } }),
            select: { reference: true, type: true },
          })
        : [];
    const txnTypeByRef = new Map(
      linkedTxns.map((t) => [t.reference!, t.type as "CREDIT" | "DEBIT"])
    );

    const withType = debitNotes.map((dn: any) => ({
      ...dn,
      type: inferAdjustmentType({
        reference: dn.debitNoteNumber,
        description: dn.description,
        transactionType: txnTypeByRef.get(dn.debitNoteNumber) ?? null,
        fallback: "DEBIT",
      }),
    }));

    // Get total count for pagination
    const total = await prisma.debitNote.count({ where });

    // Get total amount sum
    const sumResult = await prisma.debitNote.aggregate({
      where,
      _sum: {
        amount: true,
      },
    });
    const totalAmount = sumResult._sum.amount ?? 0;

    return NextResponse.json({
      debitNotes: withType,
      total,
      totalAmount,
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
    const auth = await requirePermission(request, "manage_billing");
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await request.json();
    const { billId, vendorId, amount, date, description, currency = "USD", type, debitAccountId, creditAccountId } = body;

    const vendor = await prisma.vendors.findFirst({
      where: orgWhere(session, { id: parseInt(String(vendorId), 10) }),
    });
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    if (billId) {
      const bill = await prisma.invoice.findFirst({
        where: orgWhere(session, { id: parseInt(String(billId), 10), profile: "Vendor" }),
      });
      if (!bill) {
        return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      }
    }

    // Validate required fields
    if (!vendorId || !amount || !date) {
      return NextResponse.json(
        { error: "Vendor, amount, and date are required" },
        { status: 400 }
      );
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    // Get account IDs for journal entries - use provided IDs or fall back to defaults
    let vendorExpenseId: number, cashId: number, otherIncomeId: number;
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
        vendorExpenseId = ids.vendorExpenseId;
        cashId = ids.cashId;
        otherIncomeId = ids.otherIncomeId;
      } catch (e: any) {
        return NextResponse.json(
          { error: e?.message || "Required accounts missing. Please configure Chart of Accounts." },
          { status: 400 }
        );
      }
    }

    const entryType: "CREDIT" | "DEBIT" = type === "CREDIT" ? "CREDIT" : "DEBIT";
    const seqKey = entryType === "CREDIT" ? "credit_note" : "debit_note";
    const nextSeq = await nextSequenceNumber(prisma, session.organizationId, seqKey);
    const debitNoteNumber = formatAdjustmentReference(entryType, nextSeq);

    const nextEntryNumber = await nextJournalEntryNumber(prisma, session.organizationId);

    if (entryType === "DEBIT") {
      // Use transaction to ensure all operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        const lineDesc = normalizeNoteLineDescription(
          "debit",
          description,
          debitNoteNumber
        );
        // Create the debit note
        const debitNote = await tx.debitNote.create({
          data: {
            organizationId: session.organizationId,
            debitNoteNumber,
            billId: billId ? parseInt(billId) : null,
            vendorId: parseInt(vendorId),
            amount: parseFloat(amount),
            date: parseDateInputAsLocalDate(date),
            description: lineDesc,
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
          data: orgData(session, {
            transactionType: "EXPENSE",
            category: "Vendor Payment",
            date: parseDateInputAsLocalDate(date),
            amount: parseFloat(amount),
            fromPartyType: "US",
            fromCustomer: "Company",
            toPartyType: "VENDOR",
            toVendorId: parseInt(vendorId),
            toVendor: "Vendor",
            mode: "CASH",
            reference: debitNoteNumber,
            invoice: billId ? `Bill ${billId}` : undefined,
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
            reference: debitNoteNumber,
            totalDebit: parseFloat(amount),
            totalCredit: parseFloat(amount),
            isPosted: true,
            postedAt: journalEntryDate,
          },
        });

        // Create journal entry lines for positive amount
        // Use provided account IDs or defaults
        const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : vendorExpenseId;
        const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : cashId;
        
        // Debit Account
        await tx.journalEntryLine.create({
          data: {
            organizationId: session.organizationId,
            journalEntryId: journalEntry.id,
            accountId: debitAccId,
            debitAmount: parseFloat(amount),
            creditAmount: 0,
            description: lineDesc,
            reference: debitNoteNumber,
          },
        });

        // Credit Account
        await tx.journalEntryLine.create({
          data: {
            organizationId: session.organizationId,
            journalEntryId: journalEntry.id,
            accountId: creditAccId,
            debitAmount: 0,
            creditAmount: parseFloat(amount),
            description: lineDesc,
            reference: debitNoteNumber,
          },
        });

        // Create vendor transaction (debit)
        await addVendorTransaction(
          tx,
          parseInt(vendorId),
          "DEBIT",
          parseFloat(amount),
          lineDesc,
          debitNoteNumber,
          billId ? `Bill ${billId}` : undefined,
          parseDateInputAsLocalDate(date),
          session.organizationId
        );

        return { debitNote, payment, journalEntry };
      });

      return NextResponse.json(result.debitNote, { status: 201 });
    } else if (entryType === "CREDIT") {
      // Use transaction to ensure all operations succeed or fail together
      const result = await prisma.$transaction(async (tx) => {
        const lineDesc = normalizeNoteLineDescription(
          "credit",
          description,
          debitNoteNumber
        );
        // Create the debit note
        const debitNote = await tx.debitNote.create({
          data: {
            organizationId: session.organizationId,
            debitNoteNumber,
            billId: billId ? parseInt(billId) : null,
            vendorId: parseInt(vendorId),
            amount: parseFloat(amount),
            date: parseDateInputAsLocalDate(date),
            description: lineDesc,
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
          data: orgData(session, {
            transactionType: "INCOME",
            category: "Vendor Credit",
            date: parseDateInputAsLocalDate(date),
            amount: Math.abs(parseFloat(amount)),
            fromPartyType: "VENDOR",
            fromCustomer: "Vendor",
            toPartyType: "US",
            toVendor: "Company",
            mode: "CASH",
            reference: debitNoteNumber,
            invoice: billId ? `Bill ${billId}` : undefined,
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
            reference: debitNoteNumber,
            totalDebit: Math.abs(parseFloat(amount)),
            totalCredit: Math.abs(parseFloat(amount)),
            isPosted: true,
            postedAt: journalEntryDate,
          },
        });

        // Create journal entry lines for negative amount
        // Use provided account IDs or defaults
        const debitAccId = useProvidedAccounts ? parseInt(debitAccountId) : cashId;
        const creditAccId = useProvidedAccounts ? parseInt(creditAccountId) : otherIncomeId;
        
        // Debit Account
        await tx.journalEntryLine.create({
          data: {
            organizationId: session.organizationId,
            journalEntryId: journalEntry.id,
            accountId: debitAccId,
            debitAmount: Math.abs(parseFloat(amount)),
            creditAmount: 0,
            description: lineDesc,
            reference: debitNoteNumber,
          },
        });

        // Credit Account
        await tx.journalEntryLine.create({
          data: {
            organizationId: session.organizationId,
            journalEntryId: journalEntry.id,
            accountId: creditAccId,
            debitAmount: 0,
            creditAmount: Math.abs(parseFloat(amount)),
            description: lineDesc,
            reference: debitNoteNumber,
          },
        });

        // Create vendor transaction (credit)
        await addVendorTransaction(
          tx,
          parseInt(vendorId),
          "CREDIT",
          parseFloat(amount),
          lineDesc,
          debitNoteNumber,
          billId ? `Bill ${billId}` : undefined,
          parseDateInputAsLocalDate(date),
          session.organizationId
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
